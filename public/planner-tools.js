/* Planner tools: "Plan my week" and "Week → shopping list".
   Loaded after planner.js, so it shares that file's `plans`, `selected`, `save()`, `renderMeals()`, `renderCalendar()`. */
(function () {
  const q = (s) => document.querySelector(s);
  // Recipes come from our server (/api/recipes/...), which uses Spoonacular. Real calories and diet filters are applied there.
  const api = (path) => window.nnApi("/recipes" + path);

  const SHARE = { Breakfast: 0.25, Lunch: 0.35, Dinner: 0.4, Snack: 0.1 };
  const TYPE = {
    Breakfast: "breakfast",
    Lunch: "main course",
    Dinner: "main course",
    Snack: "snack",
  };
  // Profile diet -> Spoonacular filters (Gluten-free / Dairy-free now use Spoonacular's own diet and intolerance data)
  const DIET = {
    Vegetarian: { diet: "vegetarian" },
    Vegan: { diet: "vegan" },
    Pescatarian: { diet: "pescetarian" },
    "Gluten-free": { diet: "gluten free" },
    "Dairy-free": { intolerances: "dairy" },
  };

  const shuffle = (a) => {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const looked = new Map();
  const lookup = (id) => {
    if (!looked.has(id))
      looked.set(
        id,
        api("/" + encodeURIComponent(id)).then(
          (d) => (d.meals && d.meals[0]) || null,
        ),
      );
    return looked.get(id);
  };
  function ingredientsOf(m) {
    const out = [];
    for (let i = 1; i <= 20; i++) {
      const n = (m["strIngredient" + i] || "").trim();
      if (n) out.push({ m: (m["strMeasure" + i] || "").trim(), n });
    }
    return out;
  }

  /* ---------- week helpers (calendar weeks run Sunday to Saturday) ---------- */
  function weekKeys() {
    const d = new Date(selected + "T12:00:00");
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      return keyFor(x.getFullYear(), x.getMonth(), x.getDate());
    });
  }
  const weekLabel = (k) => {
    const f = (key) =>
      new Date(key + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    return f(k[0]) + " – " + f(k[6]);
  };
  function setStatus(msg, ...extra) {
    const st = q("#tools-status");
    st.textContent = msg;
    extra.forEach((el) => st.append(" ", el));
  }

  /* ---------- Smart shopping list ---------- */
  const UNITS = {
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    ml: "ml",
    l: "l",
    tbsp: "tbsp",
    tbs: "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    tsp: "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    cup: "cup",
    cups: "cup",
    oz: "oz",
    lb: "lb",
    lbs: "lb",
  };
  function parseMeasure(text) {
    const mt = String(text)
      .toLowerCase()
      .trim()
      .match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*([a-z]*)$/);
    if (!mt) return null;
    const qty = mt[1]
      .split(/\s+/)
      .reduce(
        (sum, p) =>
          sum +
          (p.includes("/") ? p.split("/")[0] / p.split("/")[1] : Number(p)),
        0,
      );
    const raw = mt[2],
      canon = UNITS[raw];
    return { qty, key: canon || raw.replace(/s$/, ""), show: canon || raw };
  }
  function mergeIngredients(lines) {
    const map = new Map();
    lines.forEach(({ m, n }) => {
      const name = n.trim(),
        id = name.toLowerCase();
      if (!id || id === "water") return;
      const rec = map.get(id) || { name, sums: new Map() };
      const p = parseMeasure(m);
      if (p) {
        const s = rec.sums.get(p.key) || { qty: 0, show: p.show };
        s.qty += p.qty;
        if (p.qty > 1 || !s.show) s.show = p.show;
        rec.sums.set(p.key, s);
      }
      map.set(id, rec);
    });
    return [...map.values()].map(({ name, sums }) => {
      const parts = [...sums.values()].map(({ qty, show }) => {
        const n = String(+qty.toFixed(2));
        return ["g", "kg", "ml", "l"].includes(show)
          ? n + show
          : n + (show ? " " + show : "");
      });
      return {
        name,
        text: (parts.length ? parts.join(" + ") + " " : "") + name,
      };
    });
  }
  async function weekToShopping() {
    const entries = weekKeys()
      .flatMap((k) => plans[k] || [])
      .filter(Boolean);
    if (!entries.length) {
      setStatus(
        "Nothing planned for this week yet. Add meals, or use Plan my week.",
      );
      return;
    }
    setStatus("Gathering ingredients…");
    try {
      const results = await Promise.all(
        entries.map(async (e) => {
          if (e.ing && e.ing.length) return e.ing;
          if (e.id) {
            const m = await lookup(e.id).catch(() => null);
            if (m) return ingredientsOf(m);
          }
          return null;
        }),
      );
      const found = results.filter(Boolean),
        skipped = results.length - found.length;
      const merged = mergeIngredients(found.flat());
      const list = JSON.parse(store.getItem("nn-shopping-list") || "[]");
      let added = 0;
      merged.forEach(({ name, text }) => {
        if (
          list.some((it) => it.text.toLowerCase().includes(name.toLowerCase()))
        )
          return;
        list.push({ text, done: false });
        added++;
      });
      store.setItem("nn-shopping-list", JSON.stringify(list));
      const link = document.createElement("a");
      link.href = "shopping-list.html";
      link.textContent = "View list →";
      const dup = merged.length - added;
      setStatus(
        `Added ${added} ingredient${added === 1 ? "" : "s"} from ${found.length} meal${found.length === 1 ? "" : "s"}` +
          (dup ? ` (${dup} already on your list)` : "") +
          (skipped
            ? ` · ${skipped} meal${skipped === 1 ? " was" : "s were"} typed by hand, so no ingredients`
            : "") +
          ".",
        link,
      );
    } catch (e) {
      setStatus(
        (e && e.status && e.message) ||
          "Could not reach the recipe service. Check your connection and try again.",
      );
    }
  }

  /* ---------- Plan my week ---------- */
  const qs = (o) =>
    "?" +
    Object.entries(o)
      .filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => k + "=" + encodeURIComponent(v))
      .join("&");
  const pools = new Map(); // one search per meal type per run, reused for all 7 days

  async function candidates(type, target, diet) {
    const key = type + "|" + target + "|" + diet;
    if (!pools.has(key)) {
      const base = Object.assign(
        { type: TYPE[type], number: 40, sort: "random" },
        DIET[diet] || {},
      );
      const run = async (extra) =>
        (
          (await api("/search" + qs(Object.assign({}, base, extra)))).meals ||
          []
        ).filter((m) => m.nn && typeof m.nn.calories === "number");
      // Aim near the calorie target first; if that finds too little, relax the range
      pools.set(
        key,
        run({
          minCalories: Math.max(60, Math.round(target * 0.5)),
          maxCalories: Math.round(target * 1.5),
        }).then((list) => (list.length >= 4 ? list : run({}))),
      );
    }
    return pools.get(key);
  }

  async function pickMeal(type, target, diet, used) {
    const list = await candidates(type, target, diet);
    const options = shuffle(list.filter((m) => !used.has(m.idMeal)));
    if (!options.length) return null;
    // Of a handful of random options take the one closest to the calorie target
    const meal = options
      .slice(0, 6)
      .sort(
        (a, b) =>
          Math.abs(a.nn.calories - target) - Math.abs(b.nn.calories - target),
      )[0];
    return { meal, ing: ingredientsOf(meal) };
  }

  async function autoPlan({ types, keep }) {
    const u = window.nnUser || {},
      diet = u.dietary || "",
      goal = u.calorieGoal || 2000,
      keys = weekKeys();
    const snapshot = JSON.stringify(plans),
      used = new Set();
    pools.clear();
    const share = types.reduce((s, t) => s + SHARE[t], 0);
    keys.forEach((k) =>
      (plans[k] || []).forEach((e) => e && e.id && used.add(e.id)),
    );
    let added = 0,
      failed = 0;
    for (const key of keys) {
      if (!keep)
        plans[key] = (plans[key] || []).filter(
          (e) => !(e && types.includes(e.type)),
        );
      for (const type of types) {
        if (keep && (plans[key] || []).some((e) => e && e.type === type))
          continue;
        const pick = await pickMeal(
          type,
          Math.round((goal * SHARE[type]) / share),
          diet,
          used,
        );
        if (!pick) {
          failed++;
          continue;
        }
        const entry = {
          name: pick.meal.strMeal,
          type,
          kcal: pick.meal.nn.calories,
          id: pick.meal.idMeal,
        };
        if (pick.ing && pick.ing.length) entry.ing = pick.ing;
        (plans[key] ||= []).push(entry);
        used.add(entry.id);
        added++;
      }
    }
    for (const k of keys) if (plans[k] && !plans[k].length) delete plans[k];
    save();
    renderMeals();
    renderCalendar();
    const avg = Math.round(
      keys.reduce(
        (s, k) =>
          s + (plans[k] || []).reduce((t, e) => t + (Number(e.kcal) || 0), 0),
        0,
      ) / 7,
    );
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "text-button";
    undo.textContent = "Undo";
    undo.onclick = () => {
      plans = JSON.parse(snapshot);
      save();
      renderMeals();
      renderCalendar();
      setStatus("Plan restored.");
    };
    setStatus(
      `Planned ${added} meal${added === 1 ? "" : "s"} for ${weekLabel(keys)}, about ${avg} kcal a day (goal ${goal}).` +
        (failed
          ? ` ${failed} slot${failed === 1 ? "" : "s"} could not be filled.`
          : "") +
        (avg < goal * 0.85
          ? types.includes("Snack")
            ? " Calories are per-serving estimates, so you may need larger portions to reach your goal."
            : " Tip: add Snack to get closer to your goal."
          : ""),
      undo,
    );
    return { added, failed, avg };
  }

  function openDialog() {
    let d = q("#autoplan-dialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "autoplan-dialog";
      d.className = "tool-dialog";
      document.body.append(d);
    }
    const u = window.nnUser || {},
      diet = u.dietary || "",
      goal = u.calorieGoal || 2000;
    d.innerHTML = `<button class="dialog-close" aria-label="Close" type="button">×</button>
      <form class="tool-form"><p class="eyebrow">PLAN MY WEEK</p><h2>${weekLabel(weekKeys())}</h2>
      <p class="tool-note">Using your profile: <strong>${diet || "no dietary preference"}</strong> · <strong>${goal} kcal</strong> a day. <a href="profile.html">Change</a></p>
      <fieldset><legend>Which meals should I plan?</legend>
        <label><input type="checkbox" name="meal" value="Breakfast"> Breakfast</label>
        <label><input type="checkbox" name="meal" value="Lunch" checked> Lunch</label>
        <label><input type="checkbox" name="meal" value="Dinner" checked> Dinner</label>
        <label><input type="checkbox" name="meal" value="Snack"> Snack</label></fieldset>
      <label class="check"><input type="checkbox" id="keep-planned" checked> Keep meals I've already planned</label>
      <button class="button" type="submit">Generate my week <span>→</span></button><p class="tool-msg" id="auto-msg" role="status"></p></form>`;
    d.querySelector(".dialog-close").onclick = () => d.close();
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const types = [...d.querySelectorAll("input[name=meal]:checked")].map(
          (i) => i.value,
        ),
        msg = d.querySelector("#auto-msg"),
        btn = d.querySelector(".button");
      if (!types.length) {
        msg.textContent = "Pick at least one meal.";
        return;
      }
      btn.disabled = true;
      msg.textContent = "Choosing recipes…";
      try {
        await autoPlan({
          types,
          keep: d.querySelector("#keep-planned").checked,
        });
        d.close();
      } catch (e) {
        msg.textContent =
          (e && e.status && e.message) ||
          "Could not reach the recipe service. Check your connection.";
        btn.disabled = false;
      }
    };
    d.showModal ? d.showModal() : d.setAttribute("open", "");
  }

  q("#autoplan-open").onclick = openDialog;
  q("#week-shopping").onclick = weekToShopping;
  Object.assign(window, { autoPlan, weekToShopping, mergeIngredients });
})();
