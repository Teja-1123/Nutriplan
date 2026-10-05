const router = require("express").Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const { publicUser } = require("./auth");

const DIETS = [
  "",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Gluten-free",
  "Dairy-free",
];
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const AVATARS = [
  "",
  "🥑",
  "🍜",
  "🍕",
  "🍰",
  "🥕",
  "🍋",
  "🌶️",
  "🥐",
  "🍓",
  "🥗",
  "🍣",
  "🧁",
];
const COLORS = [
  "#527462",
  "#e8886e",
  "#e8b064",
  "#6f8fc9",
  "#a678c7",
  "#d46a8a",
  "#4aa3a2",
  "#8a6f5a",
];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Meal"];

/* ---------- Current user (never 401s: the front end uses it to detect login state) ---------- */
router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const user = await User.findById(req.session.userId);
    if (!user) return req.session.destroy(() => res.json({ user: null }));
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

/* ---------- Profile ---------- */
router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const update = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 60)
        return res.status(400).json({ error: "Name must be 1–60 characters." });
      update.name = name;
    }
    if (req.body.dietary !== undefined) {
      if (!DIETS.includes(req.body.dietary))
        return res.status(400).json({ error: "Unknown dietary preference." });
      update.dietary = req.body.dietary;
    }
    if (req.body.avatar !== undefined) {
      if (!AVATARS.includes(req.body.avatar))
        return res.status(400).json({ error: "Unknown avatar." });
      update.avatar = req.body.avatar;
    }
    if (req.body.avatarColor !== undefined) {
      if (!COLORS.includes(req.body.avatarColor))
        return res.status(400).json({ error: "Unknown avatar colour." });
      update.avatarColor = req.body.avatarColor;
    }
    if (req.body.calorieGoal !== undefined) {
      const goal = Number(req.body.calorieGoal);
      if (!Number.isFinite(goal) || goal < 800 || goal > 6000)
        return res
          .status(400)
          .json({ error: "Calorie goal must be between 800 and 6000." });
      update.calorieGoal = Math.round(goal);
    }
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { $set: update },
      { new: true },
    );
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.put("/profile/password", requireAuth, async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || ""),
      next_ = String(req.body.newPassword || "");
    if (next_.length < 8 || next_.length > 128)
      return res
        .status(400)
        .json({ error: "New password must be 8–128 characters." });
    const user = await User.findById(req.session.userId).select(
      "+passwordHash",
    );
    if (!user || !(await bcrypt.compare(current, user.passwordHash)))
      return res.status(403).json({ error: "Current password is incorrect." });
    user.passwordHash = await bcrypt.hash(next_, 12);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- Per-user data: saved recipes, calendar, shopping list, recent searches ---------- */

// Strip keys MongoDB treats specially and cap sizes/depth, since this data comes from the browser
function clean(value, depth = 0) {
  if (depth > 4) return null;
  if (typeof value === "string") return value.slice(0, 5000);
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return value;
  if (Array.isArray(value))
    return value.slice(0, 200).map((v) => clean(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 100)) {
      if (k.startsWith("$") || k.includes(".")) continue;
      out[k] = clean(v, depth + 1);
    }
    return out;
  }
  return null;
}
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const bad = (msg) => {
  const e = new Error(msg);
  e.status = 400;
  throw e;
};

const validators = {
  saved(v) {
    if (!Array.isArray(v) || v.length > 500) bad("Invalid saved recipes.");
    return v
      .filter((m) => isObj(m) && m.idMeal && m.strMeal)
      .map((m) => clean(m));
  },
  plans(v) {
    if (!isObj(v)) bad("Invalid calendar data.");
    const out = {};
    for (const [date, entries] of Object.entries(v)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(entries))
        continue;
      out[date] = entries
        .slice(0, 50)
        .map((e) => {
          const entry = typeof e === "string" ? { name: e, type: "Meal" } : e;
          const kcal = Math.max(
            0,
            Math.min(5000, Math.round(Number(entry.kcal) || 0)),
          );
          const meal = {
            name: String(entry.name || "").slice(0, 200),
            type: MEAL_TYPES.includes(entry.type) ? entry.type : "Meal",
          };
          if (kcal) meal.kcal = kcal;
          if (entry.id) meal.id = String(entry.id).slice(0, 40);
          if (Array.isArray(entry.ing)) {
            const ing = entry.ing
              .slice(0, 40)
              .filter((i) => i && typeof i.n === "string" && i.n.trim())
              .map((i) => ({
                m: String(i.m || "").slice(0, 40),
                n: i.n.trim().slice(0, 80),
              }));
            if (ing.length) meal.ing = ing;
          }
          return meal;
        })
        .filter((e) => e.name);
    }
    return out;
  },
  plan(v) {
    if (!isObj(v)) bad("Invalid weekly plan.");
    const out = {};
    for (const day of DAYS)
      if (Array.isArray(v[day])) out[day] = clean(v[day].slice(0, 20));
    return out;
  },
  shopping(v) {
    if (!Array.isArray(v) || v.length > 500) bad("Invalid shopping list.");
    return v
      .filter((i) => isObj(i) && typeof i.text === "string" && i.text.trim())
      .map((i) => ({ text: i.text.trim().slice(0, 200), done: !!i.done }));
  },
  pantry(v) {
    if (!Array.isArray(v)) bad("Invalid pantry.");
    return [
      ...new Set(
        v
          .filter((s) => typeof s === "string")
          .map((s) => s.trim().toLowerCase().slice(0, 40))
          .filter(Boolean),
      ),
    ].slice(0, 30);
  },
  recent(v) {
    if (!Array.isArray(v)) bad("Invalid recent searches.");
    return v
      .filter((s) => typeof s === "string")
      .map((s) => s.slice(0, 80))
      .slice(0, 10);
  },
};

router.get("/data", requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(req.session.userId).lean();
    if (!u) return res.status(401).json({ error: "Please sign in." });
    res.json({
      saved: u.saved,
      plans: u.plans,
      plan: u.plan,
      shopping: u.shopping,
      recent: u.recent,
      pantry: u.pantry || [],
    });
  } catch (e) {
    next(e);
  }
});

router.put("/data/:key", requireAuth, async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!Object.hasOwn(validators, key))
      return res.status(404).json({ error: "Unknown data type." });
    const value = validators[key](req.body.value);
    await User.updateOne(
      { _id: req.session.userId },
      { $set: { [key]: value } },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
