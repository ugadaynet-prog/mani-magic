// This file is included only in the separate phone preview build.
(() => {
  const buy = document.getElementById('pwBuyBtn');
  if (buy) { buy.disabled = true; buy.textContent = 'Покупки недоступны в тестовой версии'; }
})();
