const monthTitle = document.querySelector("#calendar-title"),
  grid = document.querySelector("#calendar-grid"),
  selectedDateLabel = document.querySelector("#selected-date"),
  mealsList = document.querySelector("#day-meals");
let shown = new Date();
shown.setDate(1);
let selected = new Date().toISOString().slice(0, 10);
let plans = JSON.parse(store.getItem("nn-calendar-plans") || "{}");
const pad = (n) => String(n).padStart(2, "0");
const keyFor = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
function save() {
  store.setItem("nn-calendar-plans", JSON.stringify(plans));
}
function renderMeals() {
  const label = new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  selectedDateLabel.textContent = label;
  mealsList.innerHTML = "";
  const meals = plans[selected] || [];
  if (!meals.length)
    mealsList.innerHTML =
      '<li class="empty-meal">Nothing planned yet—add a meal below.</li>';
  meals.forEach((meal, index) => {
    const entry =
      typeof meal === "string" ? { name: meal, type: "Meal" } : meal;
    const row = document.createElement("li");
    row.innerHTML = `<span class="meal-type ${entry.type.toLowerCase()}">${entry.type}</span><span>${entry.name}${entry.kcal ? ` <small class="kcal-tag">${entry.kcal} kcal</small>` : ""}</span><button aria-label="Remove ${entry.name}">×</button>`;
    row.querySelector("button").onclick = () => {
      plans[selected].splice(index, 1);
      save();
      renderMeals();
      renderCalendar();
    };
    mealsList.append(row);
  });
}
function renderCalendar() {
  const year = shown.getFullYear(),
    month = shown.getMonth(),
    today = new Date().toISOString().slice(0, 10);
  monthTitle.textContent = shown.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  grid.innerHTML = "";
  for (let i = 0; i < new Date(year, month, 1).getDay(); i++)
    grid.append(document.createElement("span"));
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const key = keyFor(year, month, day),
      button = document.createElement("button");
    button.textContent = day;
    button.className = `calendar-day ${key === selected ? "selected" : ""} ${key === today ? "today" : ""} ${plans[key]?.length ? "has-meal" : ""}`;
    button.onclick = () => {
      selected = key;
      renderMeals();
      renderCalendar();
    };
    grid.append(button);
  }
}
document.querySelector("#previous-month").onclick = () => {
  shown.setMonth(shown.getMonth() - 1);
  renderCalendar();
};
document.querySelector("#next-month").onclick = () => {
  shown.setMonth(shown.getMonth() + 1);
  renderCalendar();
};
document.querySelector("#meal-form").onsubmit = (e) => {
  e.preventDefault();
  const input = document.querySelector("#meal-input"),
    text = input.value.trim();
  if (text) {
    (plans[selected] ||= []).push({ name: text, type: "Meal" });
    input.value = "";
    save();
    renderMeals();
    renderCalendar();
  }
};
renderCalendar();
renderMeals();

/* Daily Calorie Ring: selected day's total vs. the goal from the user's profile */
function renderRing() {
  const el = document.querySelector("#calorie-ring");
  if (!el) return;
  const goal = (window.nnUser && window.nnUser.calorieGoal) || 2000;
  const total = (plans[selected] || []).reduce(
    (sum, m) => sum + (Number(m && m.kcal) || 0),
    0,
  );
  const pct = Math.min(total / goal, 1),
    over = total > goal,
    r = 42,
    c = +(2 * Math.PI * r).toFixed(1);
  const note = !total
    ? "Add recipes with the + button to see calories."
    : over
      ? `${total - goal} kcal over your ${goal} kcal goal`
      : `${goal - total} kcal left of your ${goal} kcal goal`;
  el.innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="${total} of ${goal} calories"><circle class="ring-bg" cx="50" cy="50" r="${r}"/><circle class="ring-fg ${over ? "over" : ""}" cx="50" cy="50" r="${r}" transform="rotate(-90 50 50)" style="--c:${c};stroke-dasharray:${c};stroke-dashoffset:${(c * (1 - pct)).toFixed(1)}"/><text x="50" y="49" class="ring-num">${total}</text><text x="50" y="64" class="ring-sub">KCAL</text></svg><div><strong>${Math.round(pct * 100)}% of daily goal</strong><span>${note}</span><small>Estimates only. Meals typed by hand count as 0.</small></div>`;
}
{
  const baseRenderMeals = renderMeals;
  renderMeals = function () {
    baseRenderMeals();
    renderRing();
  };
}
renderRing();
