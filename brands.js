'use strict';
// Бренды-партнёры: переключатель палитры в примерке и подсказка «ближайший
// оттенок бренда» под работой в колоде. Данные лежат в palettes.js
// (window.BRAND_PALETTES), здесь только логика — новый бренд кода не требует.
//
// Бренд выбирают в примерке, выбор запоминается на устройстве и тот же бренд
// подсказывается в колоде. Пока в palettes.js нет ни одного видимого бренда,
// пользователь ничего нового не видит: примерка выглядит как раньше.
(() => {
  const BRAND_KEY = 'maniMagicBrand';      // id выбранного бренда; нет записи — базовые цвета
  const TEST_KEY = 'maniMagicBrandTest';   // '1' — показывать бренды с test: true
  const REMOTE = 'https://mani-magic.ru/app/palettes.js';
  // Дальше этого расстояния (ΔE по CIE76) оттенок уже заметно другой. Лучше не
  // подсказать ничего, чем отправить мастера за чужим флаконом.
  const MAX_DE = 20;

  // ?brandtest=1 включает тестовые бренды на этом устройстве, ?brandtest=0 выключает.
  try {
    const t = new URLSearchParams(location.search).get('brandtest');
    if (t === '1') localStorage.setItem(TEST_KEY, '1');
    if (t === '0') localStorage.removeItem(TEST_KEY);
  } catch (e) {}
  function showTest() {
    try { return localStorage.getItem(TEST_KEY) === '1'; } catch (e) { return false; }
  }

  function brands() {
    const data = window.BRAND_PALETTES;
    const all = data && Array.isArray(data.brands) ? data.brands : [];
    return all.filter((b) => b && b.id && Array.isArray(b.shades) && b.shades.length && (!b.test || showTest()));
  }
  function current() {
    let id = '';
    try { id = localStorage.getItem(BRAND_KEY) || ''; } catch (e) {}
    return brands().find((b) => b.id === id) || null;
  }
  function setCurrent(id) {
    try { if (id) localStorage.setItem(BRAND_KEY, id); else localStorage.removeItem(BRAND_KEY); } catch (e) {}
  }

  // sRGB → CIELAB (D65). Близость считаем в Lab, а не в RGB: в RGB «ближайшим»
  // к пыльной розе легко оказывается серо-бежевый, глазу так не кажется.
  function lab(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const isHex = (h) => /^#?[0-9a-f]{6}$/i.test(String(h || ''));

  function nearest(hex, brand) {
    if (!brand || !isHex(hex)) return null;
    const a = lab(hex);
    let best = null, bestD = Infinity;
    brand.shades.forEach((s) => {
      if (!isHex(s.hex)) return;
      const b = lab(s.hex);
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d < bestD) { bestD = d; best = s; }
    });
    return bestD <= MAX_DE ? best : null;
  }
  function shadeLabel(brand, s) { return brand.name + ' №' + s.code + (s.name ? ' ' + s.name : ''); }

  // Примерка: над рядом цветов — кнопки «Базовые» и бренды. opts.base — базовые
  // цвета [{hex, label}], opts.baseActive — какой из них выбран при открытии,
  // opts.onPick(hex, label) — что делать при выборе оттенка.
  function mountTryon(opts) {
    const palette = opts.palette;
    // Кнопки брендов и ряд цветов — в одной обёртке на месте ряда. В сетке
    // примерки ползунок и «Свой цвет» прибиты к третьей строке: отдельная
    // строка с кнопками сдвигала цвета под ползунок.
    const wrap = document.createElement('div');
    wrap.className = 'brand-pick';
    palette.parentNode.insertBefore(wrap, palette);
    const bar = document.createElement('div');
    bar.className = 'brand-chips';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Палитра');
    wrap.append(bar, palette);

    function swatches(list, activeIndex) {
      palette.textContent = '';
      list.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch' + (i === activeIndex ? ' active' : '');
        b.style.background = s.hex;
        b.dataset.color = s.hex;
        b.setAttribute('aria-label', s.label);
        b.title = s.label;
        b.setAttribute('aria-pressed', String(i === activeIndex));
        b.onclick = () => opts.onPick(s.hex, s.label);
        palette.appendChild(b);
      });
    }
    function render() {
      const list = brands(), cur = current();
      bar.textContent = '';
      bar.classList.toggle('hidden', !list.length);
      [{ id: '', name: 'Базовые' }].concat(list).forEach((b) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'brand-chip';
        chip.textContent = b.name;
        chip.setAttribute('aria-pressed', String((cur ? cur.id : '') === b.id));
        chip.onclick = () => { setCurrent(b.id); render(); };
        bar.appendChild(chip);
      });
      if (cur) swatches(cur.shades.filter((s) => isHex(s.hex)).map((s) => ({ hex: s.hex, label: shadeLabel(cur, s) })), -1);
      else swatches(opts.base, opts.baseActive);
    }
    render();
    window.addEventListener('mani:brands', render);
  }

  // Колода: подпись «ближайший оттенок» к цвету работы. null — бренд не выбран
  // или у бренда нет близкого оттенка.
  function hintFor(hex) {
    const brand = current();
    const s = nearest(hex, brand);
    return s ? { hex: s.hex, label: shadeLabel(brand, s) } : null;
  }

  const css = document.createElement('style');
  css.textContent =
    '.brand-pick{grid-column:1/-1;display:grid;gap:4px;min-width:0}' +
    '.brand-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 3px}' +
    '.brand-chip{flex:0 0 auto;min-height:34px;padding:6px 12px;border-radius:999px;border:1px solid var(--border,#454149);' +
    'background:transparent;color:inherit;font-family:inherit;font-weight:600;font-size:13px;white-space:nowrap}' +
    '.brand-chip[aria-pressed="true"]{background:var(--paper,#f4efe9);color:var(--bg,#0d0d10);border-color:var(--paper,#f4efe9)}';
  document.head.appendChild(css);

  // В приложении из RuStore palettes.js лежит внутри сборки. Когда есть сеть,
  // берём свежий с сайта — так новый бренд появляется без выпуска новой версии.
  // Веб-версия и так грузит palettes.js с сайта. Не загрузилось — остаётся вшитый.
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && navigator.onLine !== false) {
    const s = document.createElement('script');
    s.src = REMOTE + '?d=' + new Date().toISOString().slice(0, 10);
    s.onload = () => window.dispatchEvent(new Event('mani:brands'));
    document.head.appendChild(s);
  }

  window.ManiBrands = { brands, current, nearest, hintFor, mountTryon };
})();
