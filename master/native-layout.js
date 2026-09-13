(() => {
  const native = !!window.Capacitor?.isNativePlatform?.();
  if (!native && new URLSearchParams(location.search).get('app') !== '1') return;
  const style = document.documentElement.style;
  style.setProperty('--sat', '28px');
  if (!native) { style.setProperty('--sab', '48px'); return; }
  async function apply(tries = 20) {
    try {
      const plugin = window.Capacitor.Plugins?.Insets;
      const insets = plugin?.get ? await plugin.get() : null;
      if (!insets?.ready) {
        if (tries > 0) setTimeout(() => apply(tries - 1), 150);
        return;
      }
      const num = n => Math.max(0, Math.round(Number(n) || 0));
      const bottom = num(insets.bottom);
      style.setProperty('--sat', (num(insets.top) < 8 && bottom > 0 ? 28 : num(insets.top)) + 'px');
      style.setProperty('--sab', bottom + 'px');
      style.setProperty('--sal', num(insets.left) + 'px');
      style.setProperty('--sar', num(insets.right) + 'px');
    } catch { if (tries > 0) setTimeout(() => apply(tries - 1), 150); }
  }
  apply();
  window.addEventListener('resize', () => apply(3));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(3); });
})();
