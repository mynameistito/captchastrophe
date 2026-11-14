(function () {
  var theme = null;
  try {
    var saved = localStorage.getItem('captchastrophe-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (e) {}
  if (!theme) theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
