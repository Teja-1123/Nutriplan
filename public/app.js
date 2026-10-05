const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const state = {
  recipes: [],
  selectedCategory: "",
  saved: JSON.parse(store.getItem("nn-saved") || "[]"),
  plan: JSON.parse(store.getItem("nn-plan") || "{}"),
};
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Small chips for the card (time, health score, first diet tag) and a full "At a glance" box for the pop-up, built from what the API returned
function cardBadges(meal) {
  const n = meal.nn || {},
    out = [];
  if (n.minutes) out.push(`⏱ ${n.minutes} min`);
  if (typeof n.healthScore === "number") out.push(`💚 ${n.healthScore}/100`);
  if (n.tags && n.tags.length) out.push(n.tags[0]);
  return out.length
    ? `<div class="card-badges">${out.map((b) => `<span>${esc(b)}</span>`).join("")}</div>`
    : "";
}
function glanceBox(meal) {
  const n = meal.nn || {};
  const facts = [
    n.minutes
      ? [
          "⏱",
          n.minutes >= 60
            ? `${Math.floor(n.minutes / 60)}h ${n.minutes % 60 ? (n.minutes % 60) + "m" : ""}`.trim()
            : `${n.minutes} min`,
          "ready in",
        ]
      : null,
    typeof n.healthScore === "number"
      ? ["💚", `${n.healthScore}/100`, "health score"]
      : null,
    typeof n.price === "number"
      ? ["💲", `$${n.price.toFixed(2)}`, "per serving (US$)"]
      : null,
    typeof n.likes === "number" && n.likes > 0
      ? ["👍", n.likes.toLocaleString(), "likes"]
      : null,
  ].filter(Boolean);
  const macros = [
    ["Carbs", n.carbs, "g"],
    ["Fat", n.fat, "g"],
    ["Sugar", n.sugar, "g"],
    ["Sodium", n.sodium, "mg"],
  ].filter((m) => typeof m[1] === "number");
  if (
    !facts.length &&
    !(n.tags && n.tags.length) &&
    !macros.length &&
    !n.summary
  )
    return "";
  return (
    `<aside class="glance-box" aria-label="Recipe at a glance"><h3>At a glance</h3>` +
    (facts.length
      ? `<div class="glance-facts">${facts.map((f) => `<div><span aria-hidden="true">${f[0]}</span><strong>${esc(f[1])}</strong><small>${f[2]}</small></div>`).join("")}</div>`
      : "") +
    (n.tags && n.tags.length
      ? `<div class="glance-tags">${n.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>`
      : "") +
    (macros.length
      ? `<p class="glance-macros">Per serving: ${macros.map((m) => `<b>${m[0]}</b> ${m[1]}${m[2]}`).join(" · ")}</p>`
      : "") +
    (n.summary ? `<p class="glance-summary">${esc(n.summary)}</p>` : "") +
    (n.sourceUrl
      ? `<a class="glance-source" href="${esc(n.sourceUrl)}" target="_blank" rel="noopener noreferrer">Full recipe${n.sourceName ? " on " + esc(n.sourceName) : ""} ↗</a>`
      : "") +
    `</aside>`
  );
}
const recipeGrid = $("#recipe-grid"),
  savedGrid = $("#saved-grid"),
  status = $("#recipe-status");
const isHome = document.body.dataset.page === "home";
const localRecipes = [
  {
    idMeal: "nn-tiramisu",
    strMeal: "Classic Tiramisu",
    strCategory: "Dessert",
    strArea: "Italian",
    strMealThumb:
      "https://www.themealdb.com/images/media/meals/wxywrq1468235067.jpg",
    strInstructions:
      "Whisk the egg yolks with sugar until pale and creamy.\nFold mascarpone into the mixture until smooth.\nDip ladyfingers briefly in cooled coffee and arrange in a dish.\nLayer with the mascarpone cream, then repeat.\nChill for at least 4 hours and dust with cocoa before serving.",
    strIngredient1: "Mascarpone",
    strMeasure1: "250g",
    strIngredient2: "Ladyfingers",
    strMeasure2: "20",
    strIngredient3: "Strong coffee",
    strMeasure3: "1 cup",
    strIngredient4: "Cocoa powder",
    strMeasure4: "2 tbsp",
    strIngredient5: "Eggs",
    strMeasure5: "3",
  },
  {
    idMeal: "nn-opera-cake",
    strMeal: "Opera Cake",
    strCategory: "Dessert",
    strArea: "French",
    strMealThumb:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
    strInstructions:
      "Bake a thin almond sponge until lightly golden, then cool fully.\nBrush the sponge layers with coffee syrup.\nSpread coffee buttercream over the first layer.\nAdd a layer of chocolate ganache and repeat with the remaining sponge.\nChill until firm, glaze with chocolate, and cut into neat rectangles.",
    strIngredient1: "Almond flour",
    strMeasure1: "100g",
    strIngredient2: "Eggs",
    strMeasure2: "4",
    strIngredient3: "Espresso",
    strMeasure3: "1/2 cup",
    strIngredient4: "Dark chocolate",
    strMeasure4: "180g",
    strIngredient5: "Butter",
    strMeasure5: "150g",
  },
  {
    idMeal: "nn-masala-oats",
    strMeal: "Masala Oats",
    strCategory: "Vegetarian",
    strArea: "Indian",
    strMealThumb:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    strInstructions:
      "Sauté onion, tomato, and vegetables with spices.\nAdd oats and stir for one minute.\nPour in water and simmer until creamy.\nFinish with lemon and fresh coriander.",
    strIngredient1: "Rolled oats",
    strMeasure1: "1 cup",
    strIngredient2: "Mixed vegetables",
    strMeasure2: "1 cup",
    strIngredient3: "Tomato",
    strMeasure3: "1",
    strIngredient4: "Masala spices",
    strMeasure4: "1 tsp",
  },
  {
    idMeal: "nn-paneer",
    strMeal: "Grilled Paneer Bowl",
    strCategory: "Vegetarian",
    strArea: "Indian",
    strMealThumb:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
    strInstructions:
      "Season paneer with spices and oil.\nGrill until golden on both sides.\nServe with rice, crisp vegetables, and a squeeze of lemon.",
    strIngredient1: "Paneer",
    strMeasure1: "200g",
    strIngredient2: "Rice",
    strMeasure2: "1 cup",
    strIngredient3: "Cucumber",
    strMeasure3: "1",
    strIngredient4: "Lemon",
    strMeasure4: "1/2",
  },
  {
    idMeal: "nn-ratatouille",
    strMeal: "Summer Ratatouille",
    strCategory: "Vegan",
    strArea: "French",
    strMealThumb:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    strInstructions:
      "Slice the vegetables into even rounds.\nLayer in a baking dish with herbs and olive oil.\nBake until tender and fragrant.\nServe warm with crusty bread.",
    strIngredient1: "Eggplant",
    strMeasure1: "1",
    strIngredient2: "Zucchini",
    strMeasure2: "2",
    strIngredient3: "Tomatoes",
    strMeasure3: "3",
    strIngredient4: "Olive oil",
    strMeasure4: "2 tbsp",
  },
];
let recentSearches = JSON.parse(
  store.getItem("nn-recent-searches") || '["Tiramisu","Opera Cake","Italian"]',
);
function renderRecentSearches() {
  const root = $("#recent-searches");
  if (!root) return;
  root.innerHTML = `<span>Recently searched:</span>${recentSearches
    .slice(0, 5)
    .map((term) => `<button type="button">${term}</button>`)
    .join("")}`;
  [...root.querySelectorAll("button")].forEach(
    (button) =>
      (button.onclick = () => {
        const input = $("#search-input");
        if (input) input.value = button.textContent;
        loadRecipes(button.textContent);
      }),
  );
}
function rememberSearch(query) {
  if (!query || !$("#recent-searches")) return;
  recentSearches = [
    query,
    ...recentSearches.filter(
      (item) => item.toLowerCase() !== query.toLowerCase(),
    ),
  ].slice(0, 5);
  store.setItem("nn-recent-searches", JSON.stringify(recentSearches));
  renderRecentSearches();
}
const nutritionByCategory = {
  Beef: { calories: 610, protein: 38, fibre: 6, servings: 4 },
  Breakfast: { calories: 420, protein: 18, fibre: 5, servings: 2 },
  Chicken: { calories: 540, protein: 42, fibre: 6, servings: 4 },
  Dessert: { calories: 460, protein: 7, fibre: 3, servings: 6 },
  Goat: { calories: 580, protein: 40, fibre: 5, servings: 4 },
  Lamb: { calories: 640, protein: 39, fibre: 5, servings: 4 },
  Miscellaneous: { calories: 470, protein: 21, fibre: 5, servings: 4 },
  Pasta: { calories: 520, protein: 20, fibre: 7, servings: 4 },
  Pork: { calories: 590, protein: 38, fibre: 5, servings: 4 },
  Seafood: { calories: 440, protein: 35, fibre: 4, servings: 4 },
  Side: { calories: 250, protein: 7, fibre: 6, servings: 4 },
  Starter: { calories: 310, protein: 12, fibre: 5, servings: 4 },
  Vegan: { calories: 390, protein: 15, fibre: 10, servings: 4 },
  Vegetarian: { calories: 380, protein: 16, fibre: 9, servings: 4 },
};
function nutrition(meal) {
  const base = nutritionByCategory[meal.strCategory] || {
      calories: 450,
      protein: 22,
      fibre: 6,
      servings: 4,
    },
    n = meal.nn || {};
  const pick = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  return {
    calories: pick(n.calories, base.calories),
    protein: pick(n.protein, base.protein),
    fibre: pick(n.fibre, base.fibre),
    servings: pick(n.servings, base.servings),
    real: typeof n.calories === "number",
  };
}
function estimatedCalories(meal) {
  return nutrition(meal).calories;
}

function persist() {
  store.setItem("nn-saved", JSON.stringify(state.saved));
  store.setItem("nn-plan", JSON.stringify(state.plan));
}
function planOptions() {
  return days.map((d) => `<option value="${d}">${d}</option>`).join("");
}
function mealIngredients(m) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const n = (m[`strIngredient${i}`] || "").trim();
    if (n) out.push({ m: (m[`strMeasure${i}`] || "").trim(), n });
  }
  return out;
}
function planRecipe(meal, date, type) {
  const plans = JSON.parse(store.getItem("nn-calendar-plans") || "{}");
  (plans[date] ||= []).push({
    name: meal.strMeal,
    type,
    kcal: estimatedCalories(meal),
    id: meal.idMeal,
    ing: mealIngredients(meal),
  });
  store.setItem("nn-calendar-plans", JSON.stringify(plans));
}
function openPlanPicker(meal) {
  let picker = document.querySelector("#plan-picker");
  if (!picker) {
    picker = document.createElement("dialog");
    picker.id = "plan-picker";
    document.body.append(picker);
  }
  const today = new Date().toISOString().slice(0, 10);
  picker.innerHTML = `<button class="dialog-close plan-close" aria-label="Close">×</button><form method="dialog" class="plan-picker-form"><p class="eyebrow">ADD TO PLANNER</p><h2>${meal.strMeal}</h2><label for="plan-date">Which date?</label><input id="plan-date" type="date" value="${today}" required><label for="plan-type">What meal?</label><select id="plan-type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select><button class="button" type="submit">Add to calendar <span>→</span></button><p id="plan-confirmation" class="added-message"></p></form>`;
  picker.querySelector(".plan-close").onclick = () => picker.close();
  picker.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const date = picker.querySelector("#plan-date").value,
      type = picker.querySelector("#plan-type").value;
    if (date) {
      planRecipe(meal, date, type);
      picker.querySelector("#plan-confirmation").textContent =
        `Added to ${type} on ${date}.`;
      setTimeout(() => picker.close(), 900);
    }
  };
  picker.showModal();
}
function card(meal, savedView = false) {
  const t = $("#recipe-template").content.cloneNode(true),
    card = t.querySelector(".recipe-card");
  const saved = state.saved.some((x) => x.idMeal === meal.idMeal);
  t.querySelector("img").src = meal.strMealThumb;
  t.querySelector("img").alt = meal.strMeal;
  t.querySelector(".card-meta").textContent =
    [meal.strCategory, meal.strArea].filter(Boolean).join(" · ") || "Recipe";
  t.querySelector("h3").textContent = meal.strMeal;
  const calories = document.createElement("p");
  calories.className = "calories";
  calories.textContent = `${nutrition(meal).real ? "" : "≈ "}${estimatedCalories(meal)} kcal per serving`;
  t.querySelector("h3").after(calories);
  const badges = cardBadges(meal);
  if (badges) calories.insertAdjacentHTML("afterend", badges);
  const save = t.querySelector(".save-button");
  save.textContent = saved ? "♥ Saved" : "♡ Save";
  save.classList.toggle("is-saved", saved);
  save.onclick = (e) => {
    e.stopPropagation();
    toggleSave(meal);
  };
  const planButton = t.querySelector(".plan-add");
  planButton.onclick = (e) => {
    e.stopPropagation();
    openPlanPicker(meal);
  };
  card.onclick = (e) => {
    if (!e.target.closest("button,select")) openRecipe(meal);
  };
  return t;
}
function renderRecipes() {
  recipeGrid.innerHTML = "";
  (isHome ? state.recipes.slice(0, 8) : state.recipes).forEach((m) =>
    recipeGrid.append(card(m)),
  );
  status.textContent = state.recipes.length
    ? isHome
      ? "A hand-picked preview for your week."
      : `${state.recipes.length} recipe${state.recipes.length === 1 ? "" : "s"} to try.`
    : "No recipes found — try another search.";
}
function renderSaved() {
  if (!savedGrid) return;
  savedGrid.innerHTML = "";
  state.saved.forEach((m) => savedGrid.append(card(m, true)));
  if (!state.saved.length)
    savedGrid.innerHTML =
      '<p class="status">Save recipes you want to make again.</p>';
}
function renderPlan() {
  const grid = $("#planner-grid");
  if (!grid) return;
  grid.innerHTML = "";
  days.forEach((day) => {
    const el = document.createElement("div");
    el.className = "day";
    el.innerHTML = `<h3>${day}</h3>`;
    (state.plan[day] || []).forEach((m) => {
      const x = document.createElement("div");
      x.className = "plan-item";
      x.textContent = m.strMeal;
      const b = document.createElement("button");
      b.className = "remove-item";
      b.textContent = "×";
      b.ariaLabel = `Remove ${m.strMeal}`;
      b.onclick = () => {
        state.plan[day] = state.plan[day].filter((a) => a.idMeal !== m.idMeal);
        persist();
        renderPlan();
      };
      x.append(b);
      el.append(x);
    });
    grid.append(el);
  });
}
function toggleSave(meal) {
  const i = state.saved.findIndex((x) => x.idMeal === meal.idMeal);
  i < 0 ? state.saved.push(meal) : state.saved.splice(i, 1);
  persist();
  renderRecipes();
  renderSaved();
}
function addToPlan(day, meal) {
  state.plan[day] ||= [];
  if (!state.plan[day].some((x) => x.idMeal === meal.idMeal))
    state.plan[day].push(meal);
  persist();
  renderPlan();
}
// All recipe data comes from our own server (/api/recipes/...), which talks to Spoonacular with the secret key.
async function fetchMeals(path) {
  return window.nnApi("/recipes" + path);
}
const qs = (o) =>
  "?" +
  Object.entries(o)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
async function loadRecipes(query = "") {
  status.textContent = "Finding recipes…";
  const typed = query.trim().toLowerCase();
  const aliases = {
    trimansu: "tiramisu",
    tiramissu: "tiramisu",
    "italian dishes": "Italian",
    "italian food": "Italian",
    italy: "Italian",
  };
  const search = aliases[typed] || query.trim();
  const localMatches = search
    ? localRecipes.filter((meal) =>
        `${meal.strMeal} ${meal.strCategory} ${meal.strArea}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : [];
  if (query.trim()) rememberSearch(search);
  try {
    // No search text = what's popular right now; otherwise a normal search (the server turns cuisine names like "Italian" into a cuisine filter)
    const data = await fetchMeals(
      "/search" +
        (search
          ? qs({ query: search, number: 24 })
          : qs({ sort: "popularity", number: 24 })),
    );
    const online = data.meals || [];
    state.recipes = [
      ...localMatches,
      ...online.filter(
        (meal) =>
          !localMatches.some(
            (local) =>
              local.strMeal.toLowerCase() === meal.strMeal.toLowerCase(),
          ),
      ),
    ];
    renderRecipes();
    if (!search && state.recipes.length)
      status.textContent = isHome
        ? "Trending recipes people are cooking right now."
        : `${state.recipes.length} trending recipes to try.`;
  } catch (e) {
    state.recipes = search ? localMatches : localRecipes;
    renderRecipes();
    status.textContent = state.recipes.length
      ? "Showing our own recipes — the live recipe service is unavailable right now."
      : e && e.message && e.status
        ? e.message
        : "Could not reach the recipe service. Check your internet connection and try again.";
  }
}
async function loadCategories() {
  const categoryList = $("#category-list");
  if (!categoryList) return;
  try {
    const data = await fetchMeals("/categories");
    categoryList.innerHTML = ["All", ...data.categories]
      .map(
        (n) =>
          `<button class="category ${n === "All" ? "active" : ""}">${n}</button>`,
      )
      .join("");
    [...document.querySelectorAll(".category")].forEach(
      (b) =>
        (b.onclick = async () => {
          document
            .querySelector(".category.active")
            ?.classList.remove("active");
          b.classList.add("active");
          const n = b.textContent;
          if (n === "All") return loadRecipes();
          status.textContent = "Finding recipes…";
          try {
            const d = await fetchMeals(
              "/search" + qs({ category: n, number: 24 }),
            );
            state.recipes = d.meals || [];
            renderRecipes();
          } catch (e) {
            status.textContent =
              (e && e.status && e.message) || "Could not load that category.";
          }
        }),
    );
  } catch {}
}
function addIngredientsToShopping(ingredients) {
  const list = JSON.parse(store.getItem("nn-shopping-list") || "[]");
  ingredients.forEach((text) => {
    if (!list.some((item) => item.text.toLowerCase() === text.toLowerCase()))
      list.push({ text, done: false });
  });
  store.setItem("nn-shopping-list", JSON.stringify(list));
}
function instructionSteps(text) {
  const cleaned = (text || "").replace(/\r/g, "").trim();
  const parts = cleaned
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((step) => step.trim())
    .filter((step) => step.length > 10);
  return parts.length ? parts : ["Instructions are not available."];
}
async function openRecipe(meal) {
  const dialog = $("#recipe-dialog");
  try {
    let m = meal;
    if (!m.strInstructions) {
      const d = await fetchMeals(`/${encodeURIComponent(meal.idMeal)}`);
      m = d.meals[0];
    }
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = m[`strIngredient${i}`]?.trim(),
        amt = m[`strMeasure${i}`]?.trim();
      if (ing) ingredients.push(`${amt || ""} ${ing}`.trim());
    }
    const facts = nutrition(m),
      saved = state.saved.some((item) => item.idMeal === m.idMeal),
      steps = instructionSteps(m.strInstructions);
    $("#dialog-content").innerHTML =
      `<div class="dialog-grid"><div class="dialog-left"><div class="dialog-image"><img src="${m.strMealThumb}" alt="${m.strMeal}"><button id="dialog-save" class="dialog-save ${saved ? "saved" : ""}" aria-label="Save ${m.strMeal}">${saved ? "♥" : "♡"}</button></div>${glanceBox(m)}</div><div class="dialog-copy"><p class="eyebrow">${esc([m.strCategory, m.strArea].filter(Boolean).join(" · ") || "RECIPE")}</p><h2>${m.strMeal}</h2><div class="nutrition-grid"><div><strong>${facts.real ? "" : "≈ "}${facts.calories}</strong><span>kcal / serving</span></div><div><strong>${facts.protein}g</strong><span>protein</span></div><div><strong>${facts.fibre}g</strong><span>fibre</span></div><div><strong>${facts.servings}</strong><span>servings</span></div></div><h3>Ingredients</h3><p class="ingredient-hint">Select what you need, then add it to your shopping list.</p><ul class="ingredients ingredient-checklist">${ingredients.map((item, index) => `<li><label><input type="checkbox" value="${index}" checked><span>${item}</span></label></li>`).join("")}</ul><button id="add-ingredients" class="add-ingredients">Add selected to shopping list <span>→</span></button><p id="ingredients-added" class="added-message" aria-live="polite"></p><h3>Method</h3><ol class="instruction-steps">${steps.map((step) => `<li>${step}</li>`).join("")}</ol></div></div>`;
    document.querySelector("#dialog-save").onclick = () => {
      toggleSave(m);
      const button = document.querySelector("#dialog-save"),
        nowSaved = state.saved.some((item) => item.idMeal === m.idMeal);
      button.classList.toggle("saved", nowSaved);
      button.textContent = nowSaved ? "♥" : "♡";
    };
    document.querySelector("#add-ingredients").onclick = () => {
      const selected = [
        ...document.querySelectorAll(".ingredient-checklist input:checked"),
      ].map((box) => ingredients[Number(box.value)]);
      addIngredientsToShopping(selected);
      document.querySelector("#ingredients-added").textContent =
        `${selected.length} ingredient${selected.length === 1 ? "" : "s"} added to your shopping list.`;
    };
    dialog.showModal();
  } catch {
    status.textContent = "Could not open recipe details.";
  }
}
const searchForm = $("#search-form"),
  surprise = $("#surprise");
if (searchForm)
  searchForm.onsubmit = (e) => {
    e.preventDefault();
    loadRecipes($("#search-input").value.trim());
  };
if (surprise)
  surprise.onclick = async () => {
    status.textContent = "Finding a surprise…";
    try {
      const d = await fetchMeals("/random");
      state.recipes = d.meals || [];
      renderRecipes();
      document
        .querySelector("#discover")
        .scrollIntoView({ behavior: "smooth" });
    } catch {
      status.textContent = "Could not find a recipe.";
    }
  };
$("#close-dialog").onclick = () => $("#recipe-dialog").close();
$("#clear-plan")?.addEventListener("click", () => {
  state.plan = {};
  persist();
  renderPlan();
});
$("#clear-saved")?.addEventListener("click", () => {
  state.saved = [];
  persist();
  renderSaved();
  renderRecipes();
});
renderRecentSearches();
loadCategories();
if (document.body.dataset.page !== "pantry") loadRecipes();
renderSaved();
renderPlan();
