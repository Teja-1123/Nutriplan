const form = document.querySelector("#login-form"),
  errorBox = document.querySelector("#login-error");
const nameInput = document.querySelector("#name"),
  nameLabel = document.querySelector('label[for="name"]');
const passwordInput = document.querySelector("#password");
let registering = false;

async function post(path, body) {
  const res = await fetch("/api/auth/" + path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function setMode() {
  document.querySelector("#login-title").textContent = registering
    ? "Create your account."
    : "Welcome back.";
  document.querySelector("#login-intro").textContent = registering
    ? "Register with your email to begin planning."
    : "Sign in to see your saved recipes and meal plan.";
  document.querySelector("#submit-button").innerHTML =
    `${registering ? "Create account" : "Sign in"} <span>→</span>`;
  document.querySelector(".switch-copy").childNodes[0].textContent = registering
    ? "Already registered? "
    : "New to NutriPlan? ";
  document.querySelector("#switch-mode").textContent = registering
    ? "Sign in instead"
    : "Create an account";
  nameInput.hidden = nameLabel.hidden = !registering;
  nameInput.required = registering;
  passwordInput.autocomplete = registering
    ? "new-password"
    : "current-password";
  errorBox.textContent = "";
}
document.querySelector("#switch-mode").onclick = () => {
  registering = !registering;
  setMode();
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#submit-button");
  button.disabled = true;
  errorBox.textContent = "";
  try {
    const email = document.querySelector("#email").value.trim(),
      password = passwordInput.value;
    await (registering
      ? post("register", { name: nameInput.value.trim(), email, password })
      : post("login", { email, password }));
    window.location.href = "index.html";
  } catch (e) {
    errorBox.textContent = e.message;
    button.disabled = false;
  }
});

// Already signed in? Skip the form.
fetch("/api/me", { credentials: "same-origin" })
  .then((r) => r.json())
  .then((d) => {
    if (d.user) window.location.href = "index.html";
  })
  .catch(() => {});
setMode();
