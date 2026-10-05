(function () {
  try {
    if (localStorage.getItem("nn-theme") === "dark")
      document.documentElement.dataset.theme = "dark";
  } catch (e) {}
  window.nnToggleTheme = function () {
    var root = document.documentElement,
      dark = root.dataset.theme !== "dark";
    if (dark) root.dataset.theme = "dark";
    else delete root.dataset.theme;
    try {
      localStorage.setItem("nn-theme", dark ? "dark" : "light");
    } catch (e) {}
    return dark;
  };
})();
