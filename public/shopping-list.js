const groupsRoot = document.querySelector("#shopping-groups"),
  count = document.querySelector("#shopping-count");
let items = JSON.parse(store.getItem("nn-shopping-list") || "[]");
const groups = [
  {
    name: "Fruits & vegetables",
    icon: "🥬",
    words: [
      "tomato",
      "onion",
      "potato",
      "carrot",
      "pepper",
      "garlic",
      "lemon",
      "lime",
      "apple",
      "banana",
      "spinach",
      "salad",
      "lettuce",
      "broccoli",
      "mushroom",
      "avocado",
      "cucumber",
      "pea",
      "bean",
      "chilli",
      "chili",
      "ginger",
      "herb",
    ],
  },
  {
    name: "Bakery",
    icon: "🥖",
    words: ["bread", "bun", "roll", "tortilla", "pastry", "flour", "cake"],
  },
  {
    name: "Meat & fish",
    icon: "🥩",
    words: [
      "chicken",
      "beef",
      "pork",
      "lamb",
      "fish",
      "prawn",
      "shrimp",
      "salmon",
      "tuna",
      "turkey",
      "bacon",
      "meat",
    ],
  },
  {
    name: "Dairy & eggs",
    icon: "🥛",
    words: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "egg"],
  },
  { name: "Frozen", icon: "🧊", words: ["frozen", "ice cream"] },
  { name: "Pantry & grocery", icon: "🛒", words: [] },
];
function groupFor(text) {
  const lower = text.toLowerCase();
  return (
    groups.find((group) => group.words.some((word) => lower.includes(word))) ||
    groups[groups.length - 1]
  );
}
function save() {
  store.setItem("nn-shopping-list", JSON.stringify(items));
}
function render() {
  groupsRoot.innerHTML = "";
  const remaining = items.filter((item) => !item.done).length;
  count.textContent = items.length
    ? `${remaining} item${remaining === 1 ? "" : "s"} left for this week.`
    : "Your list is ready for ingredients.";
  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "grocery-group";
    const groupItems = items.filter(
      (item) => groupFor(item.text).name === group.name,
    );
    section.innerHTML = `<h2><span>${group.icon}</span>${group.name}</h2><ul class="grocery-items"></ul><form class="group-add"><input required placeholder="+ Add item" aria-label="Add item to ${group.name}" /><button type="submit">Add</button></form>`;
    const list = section.querySelector(".grocery-items");
    groupItems.forEach((item) => {
      const index = items.indexOf(item),
        row = document.createElement("li");
      row.className = item.done ? "done" : "";
      row.innerHTML = `<label><input type="checkbox" ${item.done ? "checked" : ""} /><span>${item.text}</span></label><button aria-label="Remove ${item.text}">×</button>`;
      row.querySelector("input").onchange = () => {
        items[index].done = !items[index].done;
        save();
        render();
      };
      row.querySelector("button").onclick = () => {
        items.splice(index, 1);
        save();
        render();
      };
      list.append(row);
    });
    section.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const input = section.querySelector("input"),
        text = input.value.trim();
      if (text) {
        items.push({ text, done: false });
        save();
        render();
      }
    };
    groupsRoot.append(section);
  });
}
document.querySelector("#clear-shopping").onclick = () => {
  items = items.filter((item) => !item.done);
  save();
  render();
};
render();
