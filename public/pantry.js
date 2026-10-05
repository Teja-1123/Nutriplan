/* Pantry Match. Loaded after app.js (shares its `state`, `renderRecipes`, `recipeGrid`, `fetchMeals`, `store`). */
(function () {
  const note = document.querySelector("#recipe-status"),
    input = document.querySelector("#pantry-input");
  const chips = document.querySelector("#pantry-chips"),
    quick = document.querySelector("#pantry-quick");
  const COMMON = [
    "chicken",
    "egg",
    "rice",
    "tomato",
    "onion",
    "potato",
    "garlic",
    "cheese",
    "pasta",
    "spinach",
    "mushroom",
    "salmon",
  ];
  const STAPLES = [
    "salt",
    "pepper",
    "black pepper",
    "water",
    "oil",
    "olive oil",
    "vegetable oil",
    "sea salt",
  ]; // assumed to be in every kitchen
  let pantry = [],
    info = new Map();
  try {
    pantry = JSON.parse(store.getItem("nn-pantry") || "[]");
  } catch {}

  const persist = () => store.setItem("nn-pantry", JSON.stringify(pantry));
  function renderChips() {
    chips.innerHTML = "";
    pantry.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pantry-chip";
      b.textContent = p + " ×";
      b.setAttribute("aria-label", "Remove " + p);
      b.onclick = () => {
        pantry.splice(i, 1);
        persist();
        renderChips();
      };
      chips.append(b);
    });
  }
  function add(term) {
    term = term.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (!term || pantry.includes(term) || pantry.length >= 12) return;
    pantry.push(term);
    persist();
    renderChips();
  }
  COMMON.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "+ " + c;
    b.onclick = () => add(c);
    quick.append(b);
  });
  document.querySelector("#pantry-add").onclick = () => {
    add(input.value);
    input.value = "";
    input.focus();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input.value);
      input.value = "";
    }
  });

  function addMissing(names) {
    const list = JSON.parse(store.getItem("nn-shopping-list") || "[]");
    let n = 0;
    names.forEach((name) => {
      if (
        !list.some((i) => i.text.toLowerCase().includes(name.toLowerCase()))
      ) {
        list.push({ text: name, done: false });
        n++;
      }
    });
    store.setItem("nn-shopping-list", JSON.stringify(list));
    return n;
  }

  function score(meal) {
    const names = [];
    for (let i = 1; i <= 20; i++) {
      const n = (meal["strIngredient" + i] || "").trim();
      if (n) names.push(n);
    }
    const needed = names.filter((n) => !STAPLES.includes(n.toLowerCase()));
    const has = (n) =>
      pantry.some((p) => {
        const a = n.toLowerCase();
        return a.includes(p) || p.includes(a);
      });
    const matched = needed.filter(has),
      missing = needed.filter((n) => !has(n));
    return {
      meal,
      matched,
      missing,
      total: needed.length,
      ratio: needed.length ? matched.length / needed.length : 0,
    };
  }

  function decorate() {
    [...recipeGrid.children].forEach((card, i) => {
      const m = state.recipes[i] && info.get(state.recipes[i].idMeal);
      if (!m || card.querySelector(".match")) return;
      const pct = Math.round(m.ratio * 100),
        box = document.createElement("div");
      box.className = "match";
      box.innerHTML =
        '<div class="match-bar"><span></span></div><strong></strong><small></small>';
      box.querySelector("span").style.width = pct + "%";
      box.querySelector("strong").textContent =
        `${m.matched.length} of ${m.total} ingredients · ${pct}%`;
      box.querySelector("small").textContent = m.missing.length
        ? `Missing: ${m.missing.slice(0, 5).join(", ")}${m.missing.length > 5 ? ` +${m.missing.length - 5} more` : ""}`
        : "You have everything. ✓";
      if (m.missing.length) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "match-add";
        b.textContent = "＋ Missing to shopping list";
        b.onclick = (e) => {
          e.stopPropagation();
          const n = addMissing(m.missing);
          b.textContent = n ? `Added ${n} ✓` : "Already on your list ✓";
          b.disabled = true;
        };
        box.append(b);
      }
      card
        .querySelector(".recipe-copy")
        .insertBefore(box, card.querySelector(".card-actions"));
    });
  }
  {
    const base = renderRecipes;
    renderRecipes = function () {
      base();
      decorate();
    };
  } // keep badges when a card is saved/unsaved

  async function find() {
    if (!pantry.length) {
      note.textContent = "Add at least one ingredient first.";
      return;
    }
    note.textContent = "Looking through the recipe book…";
    let meals = [];
    try {
      meals =
        (
          await fetchMeals(
            "/pantry?ingredients=" +
              encodeURIComponent(pantry.slice(0, 12).join(",")),
          )
        ).meals || [];
    } catch (e) {
      state.recipes = [];
      info = new Map();
      renderRecipes();
      note.textContent =
        (e && e.status && e.message) ||
        "Could not reach the recipe service. Check your connection and try again.";
      return;
    }
    if (!meals.length) {
      state.recipes = [];
      info = new Map();
      renderRecipes();
      note.textContent =
        'No recipes found for those ingredients. Try common names like "chicken" or "tomato".';
      return;
    }
    const ranked = meals
      .map(score)
      .filter((s) => s.matched.length)
      .sort((a, b) => b.ratio - a.ratio || b.matched.length - a.matched.length)
      .slice(0, 12);
    info = new Map(ranked.map((s) => [s.meal.idMeal, s]));
    state.recipes = ranked.map((s) => s.meal);
    renderRecipes();
    const ready = ranked.filter((s) => !s.missing.length).length;
    note.textContent = !ranked.length
      ? "No close matches. Try adding more ingredients."
      : ready
        ? `You can cook ${ready} recipe${ready === 1 ? "" : "s"} right now. Best matches first.`
        : `${ranked.length} recipes ranked by how much you already have.`;
  }
  document.querySelector("#pantry-form").onsubmit = (e) => {
    e.preventDefault();
    if (input.value.trim()) {
      add(input.value);
      input.value = "";
    }
    find();
  };

  renderChips();
  if (pantry.length)
    note.textContent = "Your saved pantry is ready. Press Find recipes.";
  window.pantryFind = find;
})();
