/* Recipes API: a thin proxy in front of Spoonacular (https://spoonacular.com/food-api).
   - The API key stays on the server (SPOONACULAR_API_KEY in .env), never in the browser.
   - Responses are converted to the same "meal" shape the front end already uses
     (idMeal, strMeal, strIngredient1..20 ...) plus a real `nn` nutrition block.
   - Results are cached in memory to save your daily Spoonacular quota. */
const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const BASE = "https://api.spoonacular.com";
const KEY = () => process.env.SPOONACULAR_API_KEY || "";
const hasKey = () => KEY() && !/^(your|dummy|change|xxx)/i.test(KEY());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many recipe requests. Please slow down a little." },
});
router.use(limiter);

/* ---------- Categories shown as chips on the Recipes page ---------- */
const CATEGORIES = {
  Trending: { sort: "popularity" },
  Breakfast: { type: "breakfast" },
  "Main course": { type: "main course" },
  Soup: { type: "soup" },
  Salad: { type: "salad" },
  Appetizer: { type: "appetizer" },
  "Side dish": { type: "side dish" },
  Snack: { type: "snack" },
  Dessert: { type: "dessert" },
  Vegetarian: { diet: "vegetarian" },
  Vegan: { diet: "vegan" },
  "Gluten free": { diet: "gluten free" },
  Seafood: { diet: "pescetarian" },
};
const CUISINES = [
  "african",
  "american",
  "british",
  "cajun",
  "caribbean",
  "chinese",
  "eastern european",
  "european",
  "french",
  "german",
  "greek",
  "indian",
  "irish",
  "italian",
  "japanese",
  "jewish",
  "korean",
  "latin american",
  "mediterranean",
  "mexican",
  "middle eastern",
  "nordic",
  "southern",
  "spanish",
  "thai",
  "vietnamese",
];
const TYPES = [
  "main course",
  "side dish",
  "dessert",
  "appetizer",
  "salad",
  "bread",
  "breakfast",
  "soup",
  "beverage",
  "sauce",
  "marinade",
  "fingerfood",
  "snack",
  "drink",
];
const DIETS = [
  "gluten free",
  "ketogenic",
  "vegetarian",
  "lacto-vegetarian",
  "ovo-vegetarian",
  "vegan",
  "pescetarian",
  "paleo",
  "primal",
  "low fodmap",
  "whole30",
];
const INTOLERANCES = [
  "dairy",
  "egg",
  "gluten",
  "grain",
  "peanut",
  "seafood",
  "sesame",
  "shellfish",
  "soy",
  "sulfite",
  "tree nut",
  "wheat",
];

/* ---------- Tiny TTL cache + de-duplication of identical in-flight requests ---------- */
const cache = new Map(),
  inflight = new Map();
const TTL = { search: 6 * 3600e3, recipe: 24 * 3600e3 };
function remember(key, ttl, value) {
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, { value, exp: Date.now() + ttl });
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function spoon(path, params, { ttl = TTL.search, noCache = false } = {}) {
  if (!hasKey())
    throw new ApiError(
      503,
      "Recipe service is not configured. Add SPOONACULAR_API_KEY to the server .env file.",
    );
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) url.searchParams.set(k, v);
  });
  const cacheKey = url.toString(); // key excludes apiKey (added below)
  if (!noCache) {
    const hit = cache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.value;
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);
  }
  url.searchParams.set("apiKey", KEY());
  const run = (async () => {
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      throw new ApiError(502, "Could not reach the recipe service.");
    }
    if (res.status === 401 || res.status === 403)
      throw new ApiError(
        503,
        "The Spoonacular API key was rejected. Check SPOONACULAR_API_KEY.",
      );
    if (res.status === 402 || res.status === 429)
      throw new ApiError(
        503,
        "The daily recipe quota has been used up. Try again later.",
      );
    if (res.status === 404) throw new ApiError(404, "Recipe not found.");
    if (!res.ok)
      throw new ApiError(502, "The recipe service returned an error.");
    const data = await res.json();
    if (!noCache) remember(cacheKey, ttl, data);
    return data;
  })();
  if (!noCache) {
    inflight.set(cacheKey, run);
    run.then(
      () => inflight.delete(cacheKey),
      () => inflight.delete(cacheKey),
    );
  }
  return run;
}

/* ---------- Spoonacular recipe -> the front end's "meal" shape ---------- */
const decode = (s) =>
  String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const titleCase = (s) =>
  String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());

function categoryOf(r) {
  const t = (r.dishTypes || []).map((x) => x.toLowerCase());
  if (r.vegan) return "Vegan";
  const pick = [
    "breakfast",
    "dessert",
    "soup",
    "salad",
    "appetizer",
    "side dish",
    "snack",
    "main course",
  ].find(
    (x) =>
      t.includes(x) ||
      (x === "main course" &&
        (t.includes("lunch") ||
          t.includes("dinner") ||
          t.includes("main dish"))),
  );
  if (pick) return titleCase(pick);
  if (r.vegetarian) return "Vegetarian";
  return titleCase(t[0] || "Main course");
}

function amountText(i) {
  const m = (i.measures && i.measures.metric) || {},
    u = (i.measures && i.measures.us) || {};
  const pick = u.amount && u.unitShort ? u : m; // US measures read more naturally for cooking
  if (!pick.amount) return "";
  const n = Number(pick.amount),
    amt = Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
  return (amt + " " + (pick.unitShort || "")).trim();
}

// Search results give a 312x231 thumbnail; the same file exists at 636x393, which stays sharp in the pop-up
const bigImage = (url) =>
  String(url || "").replace(
    /-(312x231|240x150|480x360|556x370)\.(jpg|jpeg|png)$/i,
    "-636x393.$2",
  );

function normalize(r) {
  if (!r || !r.id) return null;
  const nutrients = (r.nutrition && r.nutrition.nutrients) || [];
  const nut = (name) => {
    const x = nutrients.find((n) => n.name === name);
    return x ? Math.round(x.amount) : null;
  };
  const calories = nut("Calories"),
    servings = r.servings || 1;

  let steps = [];
  (r.analyzedInstructions || []).forEach((g) =>
    (g.steps || []).forEach((s) => steps.push(decode(s.step))),
  );
  if (!steps.length && r.instructions)
    steps = decode(r.instructions).split(/(?<=[.!?])\s+(?=[A-Z])/);
  steps = steps.filter(Boolean);

  // Short plain-text summary: drop Spoonacular's own "score" sentences, keep the first couple of sentences
  const summary = decode(r.summary)
    .split(/(?<=[.!?])\s+/)
    .filter(
      (x) =>
        x &&
        !/spoonacular score|similar recipes|comparing this recipe/i.test(x),
    )
    .slice(0, 2)
    .join(" ")
    .slice(0, 320);
  const tags = [];
  if (r.vegan) tags.push("Vegan");
  else if (r.vegetarian) tags.push("Vegetarian");
  if (r.glutenFree) tags.push("Gluten free");
  if (r.dairyFree) tags.push("Dairy free");
  if (r.veryHealthy) tags.push("Very healthy");
  if (r.cheap) tags.push("Budget friendly");
  if (r.veryPopular) tags.push("Popular");
  if (r.lowFodmap) tags.push("Low FODMAP");

  const meal = {
    idMeal: String(r.id),
    strMeal: decode(r.title),
    strCategory: categoryOf(r),
    strArea: titleCase((r.cuisines && r.cuisines[0]) || ""),
    strMealThumb: bigImage(r.image),
    strInstructions: steps.join("\n"),
    nn: {
      calories,
      protein: nut("Protein"),
      fibre: nut("Fiber"),
      servings,
      carbs: nut("Carbohydrates"),
      fat: nut("Fat"),
      sugar: nut("Sugar"),
      sodium: nut("Sodium"),
      minutes: r.readyInMinutes || null,
      healthScore: Number.isFinite(r.healthScore)
        ? Math.round(r.healthScore)
        : null,
      price: Number.isFinite(r.pricePerServing)
        ? Math.round(r.pricePerServing) / 100
        : null, // US$ per serving
      likes: Number.isFinite(r.aggregateLikes) ? r.aggregateLikes : null,
      tags,
      summary,
      sourceName: decode(r.sourceName).slice(0, 60),
      sourceUrl: /^https?:\/\//.test(r.spoonacularSourceUrl || "")
        ? r.spoonacularSourceUrl
        : "",
      source: "spoonacular",
    },
  };
  // Without nutrition data the front end falls back to its category estimates
  Object.keys(meal.nn).forEach((k) => {
    if (meal.nn[k] === null || meal.nn[k] === "") delete meal.nn[k];
  });

  const ings = r.extendedIngredients || [],
    seen = new Set();
  ings
    .filter(
      (i) =>
        i &&
        i.name &&
        !seen.has(i.name.toLowerCase()) &&
        seen.add(i.name.toLowerCase()),
    )
    .slice(0, 20)
    .forEach((i, k) => {
      meal["strIngredient" + (k + 1)] = titleCase(i.name);
      meal["strMeasure" + (k + 1)] = amountText(i);
    });
  return meal;
}

/* ---------- Helpers ---------- */
const clamp = (v, lo, hi, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const oneOf = (v, list) => {
  const s = String(v || "")
    .toLowerCase()
    .trim();
  return list.includes(s) ? s : "";
};
const listOf = (v, list) =>
  String(v || "")
    .split(",")
    .map((x) => x.toLowerCase().trim())
    .filter((x) => list.includes(x))
    .join(",");
const text = (v, n = 60) =>
  String(v || "")
    .trim()
    .slice(0, n);
const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n < 10000 ? n : "";
};

/* ---------- Routes ---------- */
router.get("/recipes/categories", (req, res) =>
  res.json({ categories: Object.keys(CATEGORIES) }),
);

// Search. Always returns full details (ingredients, steps, nutrition) so cards and dialogs need no second request.
router.get("/recipes/search", async (req, res, next) => {
  try {
    const q = text(req.query.query),
      cat = CATEGORIES[text(req.query.category)] || {};
    let cuisine = listOf(req.query.cuisine, CUISINES);
    let query = q;
    if (q && CUISINES.includes(q.toLowerCase())) {
      cuisine = q.toLowerCase();
      query = "";
    } // "Italian" -> cuisine filter

    const params = {
      query,
      cuisine,
      type: oneOf(req.query.type, TYPES) || cat.type || "",
      diet: oneOf(req.query.diet, DIETS) || cat.diet || "",
      intolerances: listOf(req.query.intolerances, INTOLERANCES),
      includeIngredients: text(req.query.includeIngredients, 200),
      minCalories: num(req.query.minCalories),
      maxCalories: num(req.query.maxCalories),
      sort: [
        "popularity",
        "healthiness",
        "time",
        "random",
        "max-used-ingredients",
        "min-missing-ingredients",
      ].includes(req.query.sort)
        ? req.query.sort
        : cat.sort || (query ? "meta-score" : "popularity"),
      number: clamp(req.query.number, 1, 40, 12),
      offset: clamp(req.query.offset, 0, 900, 0),
      instructionsRequired: true,
      addRecipeInformation: true,
      fillIngredients: true,
      addRecipeNutrition: true,
    };
    const data = await spoon("/recipes/complexSearch", params, {
      noCache: params.sort === "random",
    });
    res.json({
      meals: (data.results || []).map(normalize).filter(Boolean),
      total: data.totalResults || 0,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/recipes/random", async (req, res, next) => {
  try {
    const data = await spoon(
      "/recipes/random",
      { number: 1, include_nutrition: true },
      { noCache: true },
    );
    res.json({ meals: (data.recipes || []).map(normalize).filter(Boolean) });
  } catch (e) {
    next(e);
  }
});

// Pantry match: recipes that use the most of what you have (ranked by Spoonacular), returned with full details
router.get("/recipes/pantry", async (req, res, next) => {
  try {
    const ingredients = String(req.query.ingredients || "")
      .split(",")
      .map((x) => text(x, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 12);
    if (!ingredients.length) return res.json({ meals: [] });
    const found = await spoon("/recipes/findByIngredients", {
      ingredients: ingredients.join(","),
      number: 20,
      ranking: 2,
      ignorePantry: true,
    });
    const ids = (found || []).map((r) => r.id).filter(Boolean);
    if (!ids.length) return res.json({ meals: [] });
    const full = await spoon(
      "/recipes/informationBulk",
      { ids: ids.join(","), includeNutrition: true },
      { ttl: TTL.recipe },
    );
    const byId = new Map((full || []).map((r) => [r.id, r]));
    res.json({
      meals: ids.map((id) => normalize(byId.get(id))).filter(Boolean),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/recipes/:id", async (req, res, next) => {
  try {
    if (!/^\d{1,9}$/.test(req.params.id))
      return res.status(404).json({ error: "Recipe not found." });
    const data = await spoon(
      `/recipes/${req.params.id}/information`,
      { includeNutrition: true },
      { ttl: TTL.recipe },
    );
    res.json({ meals: [normalize(data)].filter(Boolean) });
  } catch (e) {
    next(e);
  }
});

// Friendly JSON errors for this router
router.use((err, req, res, next) => {
  if (err instanceof ApiError)
    return res.status(err.status).json({ error: err.message });
  next(err);
});

module.exports = router;
module.exports.normalize = normalize;
