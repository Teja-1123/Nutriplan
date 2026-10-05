const $ = (s) => document.querySelector(s);
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
let avatar = "",
  color = COLORS[0];

const count = (key) => {
  try {
    const v = JSON.parse(store.getItem(key) || "null");
    return Array.isArray(v)
      ? v.length
      : Object.values(v || {}).reduce((n, a) => n + a.length, 0);
  } catch {
    return 0;
  }
};
const preview = () =>
  nnPaint($("#avatar-preview"), {
    name: $("#p-name").value || window.nnUser.name,
    avatar,
    avatarColor: color,
  });

function buildPickers() {
  $("#avatar-grid").innerHTML = "";
  AVATARS.forEach((a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a || "Aa";
    b.title = a ? "Emoji avatar" : "Use my initial";
    b.setAttribute("aria-pressed", String(a === avatar));
    b.onclick = () => {
      avatar = a;
      buildPickers();
      preview();
    };
    $("#avatar-grid").append(b);
  });
  $("#color-grid").innerHTML = "";
  COLORS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = c;
    b.setAttribute("aria-label", "Colour " + c);
    b.setAttribute("aria-pressed", String(c === color));
    b.onclick = () => {
      color = c;
      buildPickers();
      preview();
    };
    $("#color-grid").append(b);
  });
}

function fill(u) {
  avatar = u.avatar || "";
  color = u.avatarColor || COLORS[0];
  $("#profile-heading").textContent = `Hello, ${u.name.split(" ")[0]}.`;
  $("#p-name").value = u.name;
  $("#p-email").value = u.email;
  $("#p-diet").value = u.dietary || "";
  $("#p-goal").value = u.calorieGoal;
  const since = new Date(u.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  $("#profile-stats").textContent =
    `${count("nn-saved")} saved recipes · ${count("nn-calendar-plans")} planned meals · ${count("nn-shopping-list")} shopping items · member since ${since}`;
  buildPickers();
  preview();
}
fill(window.nnUser);
$("#p-name").addEventListener("input", preview);

const show = (el, text, ok) => {
  el.textContent = text;
  el.style.color = ok ? "var(--green)" : "#c95157";
};
$("#profile-form").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const { user } = await nnApi("/profile", {
      method: "PUT",
      body: {
        name: $("#p-name").value,
        dietary: $("#p-diet").value,
        calorieGoal: $("#p-goal").value,
        avatar,
        avatarColor: color,
      },
    });
    window.nnUser = user;
    fill(user);
    nnRefreshAccount();
    show($("#profile-msg"), "Profile saved.", true);
  } catch (err) {
    show($("#profile-msg"), err.message, false);
  }
};
$("#password-form").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await nnApi("/profile/password", {
      method: "PUT",
      body: {
        currentPassword: $("#p-current").value,
        newPassword: $("#p-new").value,
      },
    });
    e.target.reset();
    show($("#password-msg"), "Password updated.", true);
  } catch (err) {
    show($("#password-msg"), err.message, false);
  }
};
