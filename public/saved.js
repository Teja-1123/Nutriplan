const grid = document.querySelector("#saved-grid"),
  status = document.querySelector("#saved-status");
let saved = JSON.parse(store.getItem("nn-saved") || "[]");
function render() {
  grid.innerHTML = "";
  if (!saved.length) {
    status.textContent =
      "No saved recipes yet. Open a recipe and press the heart to keep it here.";
    return;
  }
  status.textContent = `${saved.length} saved recipe${saved.length === 1 ? "" : "s"}.`;
  saved.forEach((meal) => {
    const card = document.createElement("article");
    card.className = "recipe-card saved-card";
    card.innerHTML = `<img src="${meal.strMealThumb}" alt="${meal.strMeal}"><div class="recipe-copy"><div class="card-meta">${[meal.strCategory, meal.strArea].filter(Boolean).join(" · ") || "Recipe"}</div><h3>${meal.strMeal}</h3><button class="saved-remove">♥ Saved</button></div>`;
    card.querySelector(".saved-remove").onclick = () => {
      saved = saved.filter((item) => item.idMeal !== meal.idMeal);
      store.setItem("nn-saved", JSON.stringify(saved));
      render();
    };
    grid.append(card);
  });
}
document.querySelector("#clear-saved").onclick = () => {
  saved = [];
  store.setItem("nn-saved", "[]");
  render();
};
render();
