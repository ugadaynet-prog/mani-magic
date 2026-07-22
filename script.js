if ('serviceWorker' in navigator) {
  // Как только на сервере появляется новая версия и она активируется,
  // сразу перезагружаем страницу, чтобы показать актуальный вариант.
  let refreshedOnce = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshedOnce) return;
    refreshedOnce = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

(function () {
  const cardEl = document.getElementById('card');
  const cardFrontEl = document.getElementById('cardFront');
  const frontImg = document.getElementById('frontImg');
  const phraseEl = document.getElementById('phrase');
  const hintEl = document.getElementById('hint');
  const shakeBtn = document.getElementById('shakeBtn');
  const permBtn = document.getElementById('permBtn');
  const workBtn = document.getElementById('workBtn');
  const workOverlay = document.getElementById('workOverlay');
  const workImg = document.getElementById('workImg');
  const workClose = document.getElementById('workClose');
  const workPrev = document.getElementById('workPrev');
  const workNext = document.getElementById('workNext');
  const workCaption = document.getElementById('workCaption');
  const workDots = document.getElementById('workDots');

  const favBtn = document.getElementById('favBtn');
  const favCount = document.getElementById('favCount');
  const likeBtn = document.getElementById('likeBtn');
  const shareBtn = document.getElementById('shareBtn');
  const soundBtn = document.getElementById('soundBtn');
  const themeBtn = document.getElementById('themeBtn');
  const favOverlay = document.getElementById('favOverlay');
  const favClose = document.getElementById('favClose');
  const favGrid = document.getElementById('favGrid');
  const favEmpty = document.getElementById('favEmpty');
  const histNav = document.getElementById('histNav');
  const backBtn = document.getElementById('backBtn');
  const fwdBtn = document.getElementById('fwdBtn');
  const filterBtn = document.getElementById('filterBtn');
  const filterLabel = document.getElementById('filterLabel');
  const filterOverlay = document.getElementById('filterOverlay');
  const filterClose = document.getElementById('filterClose');
  const filterList = document.getElementById('filterList');
  const catalogBtn = document.getElementById('catalogBtn');
  const catalogOverlay = document.getElementById('catalogOverlay');
  const catalogClose = document.getElementById('catalogClose');
  const catalogGrid = document.getElementById('catalogGrid');

  // Подписи дизайнов берутся из карты (workLabels). Если их нет — просто «Дизайн N».
  let currentLabels = [];

  // --- Избранное (сохраняется в памяти телефона) ---
  const FAV_KEY = 'maniMagicFavorites';
  let favorites = [];
  try {
    const saved = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    if (Array.isArray(saved)) {
      favorites = saved.filter((i) => Number.isInteger(i) && i >= 0 && i < CARDS.length);
    }
  } catch (e) { favorites = []; }

  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
  }
  function updateFavUI() {
    favCount.textContent = favorites.length;
    likeBtn.classList.toggle('liked', favorites.indexOf(currentIndex) !== -1);
    likeBtn.setAttribute('aria-label',
      favorites.indexOf(currentIndex) !== -1 ? 'Убрать из избранного' : 'Добавить в избранное');
  }
  function toggleFavorite() {
    if (!hasCard) return;
    const at = favorites.indexOf(currentIndex);
    if (at === -1) favorites.push(currentIndex); else favorites.splice(at, 1);
    saveFavorites();
    updateFavUI();
  }

  function renderFavorites() {
    favGrid.innerHTML = '';
    favEmpty.classList.toggle('hidden', favorites.length > 0);
    favorites.forEach((idx) => {
      const item = document.createElement('div');
      item.className = 'fav-item';

      const img = document.createElement('img');
      img.src = CARDS[idx].front;
      img.alt = 'Карта ' + (idx + 1);
      img.addEventListener('click', () => {
        favOverlay.classList.add('hidden');
        drawCard(idx);
      });

      const rm = document.createElement('button');
      rm.className = 'fav-remove';
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Убрать из избранного');
      rm.innerHTML = '&times;';
      rm.addEventListener('click', () => {
        const at = favorites.indexOf(idx);
        if (at !== -1) favorites.splice(at, 1);
        saveFavorites();
        updateFavUI();
        renderFavorites();
      });

      item.appendChild(img);
      item.appendChild(rm);
      favGrid.appendChild(item);
    });
  }

  likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(); });

  // --- Короткое уведомление внизу экрана ---
  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    const el = toastEl;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.add('fading');
      setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
    }, 2200);
  }

  // --- Поделиться текущей картой ---
  // Ссылка ведёт прямо на эту карту (?card=N) — получатель откроет именно её.
  function shareCard() {
    if (!hasCard) return;
    const url = location.origin + location.pathname + '?card=' + (currentIndex + 1);
    const payload = { title: 'MANI Magic', text: 'Хочу такой маникюр 💅', url };

    if (navigator.share) {
      navigator.share(payload).catch(() => {});   // отмену пользователем не считаем ошибкой
      return;
    }
    // старые браузеры без системного «Поделиться» — копируем ссылку
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast('Ссылка на карту скопирована'))
        .catch(() => toast(url));
      return;
    }
    toast(url);
  }

  shareBtn.addEventListener('click', (e) => { e.stopPropagation(); shareCard(); });

  favBtn.addEventListener('click', () => { renderFavorites(); favOverlay.classList.remove('hidden'); });
  favClose.addEventListener('click', () => favOverlay.classList.add('hidden'));
  favOverlay.addEventListener('click', (e) => {
    if (e.target === favOverlay) favOverlay.classList.add('hidden');
  });

  let currentIndex = -1;
  let hasCard = false;
  let isFlipped = false;
  let isAnimating = false;
  let currentWorks = [];
  let workPos = 0;

  // --- Отладочный экран: открыть приложение со ссылкой ?debug=1 ---
  // Показывает прямо на телефоне, что происходит с тряской и вибрацией.
  const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
  let dbgBox = null, dbgLines = [];
  if (DEBUG) {
    dbgBox = document.createElement('div');
    dbgBox.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:999;' +
      'background:rgba(0,0,0,.82);color:#8f8;font:11px/1.35 monospace;' +
      'padding:6px 8px;white-space:pre-wrap;max-height:42vh;overflow:auto;';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(dbgBox));
    if (document.body) document.body.appendChild(dbgBox);
  }
  function dbg(msg) {
    if (!DEBUG) return;
    const t = new Date().toTimeString().slice(3, 8) + ':' +
      String(Date.now() % 1000).padStart(3, '0');
    dbgLines.unshift(t + '  ' + msg);
    if (dbgLines.length > 16) dbgLines.pop();
    if (dbgBox) dbgBox.textContent = dbgLines.join('\n');
  }

  // --- Отклик вибрацией, когда выпала карта ---
  // Есть в Chrome на Android. Safari на iPhone вибрацию из браузера не умеет —
  // там просто ничего не произойдёт, на работу приложения это не влияет.
  //
  // Силу вибрации из браузера задать нельзя — только длительность и ритм.
  // Поэтому «помощнее» = длинный основной толчок плюс добивка.
  const BUZZ_PATTERN = [600, 100, 400];
  const BUZZ_MS = BUZZ_PATTERN.reduce((a, b) => a + b, 0);
  const BUZZ_SETTLE = 400;   // сколько ждать после вибрации, пока телефон «успокоится»
  let canBuzz = false;       // на самой загрузке страницы не жужжим
  let buzzUntil = 0;         // до какого момента мотор ещё работает

  // Своей проверки «было ли касание» здесь намеренно нет: если браузер
  // вибрацию не разрешит, вызов просто вернёт false и ничего не случится.
  // Лишний собственный запрет умеет только ошибочно глушить рабочую вибрацию.
  // Браузер разрешает вибрацию только если по странице хоть раз коснулись
  // пальцем. Тряска за касание не считается — это защита от сайтов, которые
  // дёргали бы телефон сами по себе. Одного касания хватает до перезагрузки.
  let touchHintShown = false;

  function showTouchHint() {
    if (touchHintShown) return;
    touchHintShown = true;
    const el = document.createElement('div');
    el.className = 'touch-hint';
    el.textContent = 'Коснитесь экрана — включится вибрация';
    document.body.appendChild(el);
    const kill = () => { el.classList.add('fading'); setTimeout(() => el.remove(), 400); };
    window.addEventListener('pointerdown', kill, { once: true });
    window.addEventListener('touchstart', kill, { once: true });
    setTimeout(kill, 7000);
  }

  function buzz() {
    if (!canBuzz || typeof navigator.vibrate !== 'function') { dbg('вибро: нет API'); return; }
    const ua = navigator.userActivation;
    const touched = ua ? ua.hasBeenActive : null;
    let res;
    try { res = navigator.vibrate(BUZZ_PATTERN); }
    catch (e) { dbg('вибро: ошибка ' + e.message); return; }
    buzzUntil = Date.now() + BUZZ_MS;
    dbg('вибро: ' + (res === false ? 'ОТКЛОНЕНО' : 'принято') +
        ' | касание страницы было: ' + (touched === null ? 'н/д' : (touched ? 'да' : 'НЕТ')));
    if (res === false && touched === false) showTouchHint();
  }

  // --- Звук при вытягивании ---
  // Синтезируем короткий «свист» карты через Web Audio — внешний файл не нужен.
  // Как и вибрация, звук доступен только после первого касания страницы.
  const SOUND_KEY = 'maniMagicMuted';
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === '1'; } catch (e) {}

  const SND_ICON_ON =
    '<path d="M4 9v6h4l5 4V5L8 9H4z"></path>' +
    '<path d="M16 8.6a4 4 0 0 1 0 6.8"></path>' +
    '<path d="M18.7 6a7 7 0 0 1 0 12"></path>';
  const SND_ICON_OFF =
    '<path d="M4 9v6h4l5 4V5L8 9H4z"></path>' +
    '<line x1="16" y1="9.5" x2="21" y2="14.5"></line>' +
    '<line x1="21" y1="9.5" x2="16" y2="14.5"></line>';

  function updateSoundIcon() {
    soundBtn.querySelector('svg').innerHTML = muted ? SND_ICON_OFF : SND_ICON_ON;
    soundBtn.classList.toggle('muted', muted);
    soundBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  }

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { dbg('звук: нет Web Audio API'); return; }
      try { audioCtx = new AC(); dbg('звук: контекст создан, state=' + audioCtx.state); }
      catch (e) { audioCtx = null; dbg('звук: ошибка создания ' + e.message); return; }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => dbg('звук: возобновлён, state=' + audioCtx.state)).catch(() => {});
    }
  }
  // разблокировать звук на первом же касании (тряска касанием не считается)
  ['pointerdown', 'touchstart', 'click'].forEach((ev) =>
    window.addEventListener(ev, ensureAudio, { once: true, capture: true }));

  function playDraw() {
    if (muted) { dbg('звук: выключен пользователем'); return; }
    ensureAudio();
    if (!audioCtx) { dbg('звук: контекста нет'); return; }
    // если контекст ещё спит — будим; звук пойдёт, как только проснётся.
    // Жёсткой отсечки по state нет: иначе первое же вытягивание было бы немым.
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    try {
      const ctx = audioCtx, now = ctx.currentTime;

      // общий выход
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);

      // Мягкий «шелест» колоды: несколько тихих слоёв фильтрованного шума с
      // ПЛАВНЫМ заходом (не резким) — именно резкая атака звучит как щелчок.
      function rustle(offset, dur, fStart, fEnd, peak) {
        const t = now + offset;
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;   // шум
        const src = ctx.createBufferSource(); src.buffer = buffer;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
        bp.frequency.setValueAtTime(fStart, t);
        bp.frequency.linearRampToValueAtTime(fEnd, t + dur);   // лёгкий уход частоты вниз
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + dur * 0.4);   // мягкое нарастание
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);  // мягкий спад
        src.connect(bp); bp.connect(g); g.connect(master);
        src.start(t); src.stop(t + dur);
      }

      // два слоя со сдвигом — как несколько карт, скользящих друг за другом
      rustle(0.00, 0.34, 2600, 1500, 0.30);
      rustle(0.06, 0.30, 3300, 1900, 0.20);

      dbg('звук: играю (state=' + audioCtx.state + ')');
    } catch (e) { dbg('звук: ошибка ' + e.message); }
  }

  updateSoundIcon();
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(SOUND_KEY, muted ? '1' : '0'); } catch (e) {}
    updateSoundIcon();
    dbg('звук: ' + (muted ? 'выключен' : 'включён') + ' пользователем');
    ensureAudio();
    if (!muted) playDraw();   // при включении сразу проигрываем — слышно, что заработало
  });

  // --- Тема оформления: тёмная / светлая ---
  const THEME_KEY = 'maniMagicTheme';
  let theme = 'dark';
  try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') theme = t; } catch (e) {}

  // Иконка показывает, на ЧТО переключит: в тёмной теме — солнце (→ светлая),
  // в светлой — месяц (→ тёмная).
  const THEME_ICON_SUN =
    '<circle cx="12" cy="12" r="4.2"></circle>' +
    '<line x1="12" y1="2.5" x2="12" y2="4.5"></line>' +
    '<line x1="12" y1="19.5" x2="12" y2="21.5"></line>' +
    '<line x1="2.5" y1="12" x2="4.5" y2="12"></line>' +
    '<line x1="19.5" y1="12" x2="21.5" y2="12"></line>' +
    '<line x1="5.1" y1="5.1" x2="6.5" y2="6.5"></line>' +
    '<line x1="17.5" y1="17.5" x2="18.9" y2="18.9"></line>' +
    '<line x1="5.1" y1="18.9" x2="6.5" y2="17.5"></line>' +
    '<line x1="17.5" y1="6.5" x2="18.9" y2="5.1"></line>';
  const THEME_ICON_MOON =
    '<path d="M21 12.9A8.2 8.2 0 1 1 11.1 3 6.4 6.4 0 0 0 21 12.9z"></path>';

  // Цвет строки состояния браузера под тему
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    themeBtn.querySelector('svg').innerHTML = (theme === 'dark') ? THEME_ICON_SUN : THEME_ICON_MOON;
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#fafafa' : '#0d0d10');
  }
  applyTheme();

  themeBtn.addEventListener('click', () => {
    theme = (theme === 'dark') ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    applyTheme();
  });

  // --- История просмотра: можно вернуться к карте, которую случайно смахнули ---
  const HIST_MAX = 50;
  let history = [];
  let histPos = -1;

  function updateHistoryUI() {
    // стрелки всегда на месте; пока идти некуда — просто гаснут
    backBtn.disabled = (histPos <= 0);
    fwdBtn.disabled = (histPos >= history.length - 1);
  }

  function goBack() {
    if (histPos <= 0) return;
    histPos--;
    drawCard(history[histPos], true);
  }

  function goForward() {
    if (histPos >= history.length - 1) return;
    histPos++;
    drawCard(history[histPos], true);
  }

  function setHint(text) {
    hintEl.textContent = text;
  }

  // --- Фильтр по цвету ---
  const COLOR_GROUPS = [
    { name: 'Красные',             dots: ['#c92130', '#e53424', '#902421'] },
    { name: 'Розовые',             dots: ['#e51859', '#df5a9b', '#f297a8'] },
    { name: 'Оранжевые',           dots: ['#ed691f', '#f18b41', '#c4892d'] },
    { name: 'Жёлтые',              dots: ['#f6df5b', '#ffce08', '#e4c46d'] },
    { name: 'Зелёные и бирюзовые', dots: ['#0b7875', '#42bbc6', '#c0e0c9'] },
    { name: 'Синие',               dots: ['#253d7b', '#2b76ba', '#9ec6e9'] },
    { name: 'Фиолетовые',          dots: ['#4d3185', '#9e7fb8', '#cba2cc'] },
    { name: 'Нюд и бежевые',       dots: ['#c8b99c', '#f6c88a', '#cbb59d'] },
    { name: 'Тёмные',              dots: ['#1a2020', '#292139', '#3d2d1d'] },
    { name: 'Светлые',             dots: ['#f7f7ef', '#e8f5fd', '#fbe5e7'] },
  ];
  let activeFilter = null;   // null = все цвета

  const cardsInGroup = (g) =>
    CARDS.reduce((n, c) => n + (c.colors && c.colors.indexOf(g) !== -1 ? 1 : 0), 0);

  function filteredPool() {
    if (!activeFilter) return CARDS.map((_, i) => i);
    const pool = [];
    CARDS.forEach((c, i) => {
      if (c.colors && c.colors.indexOf(activeFilter) !== -1) pool.push(i);
    });
    return pool.length ? pool : CARDS.map((_, i) => i);
  }

  function updateFilterUI() {
    filterLabel.textContent = activeFilter || 'Все цвета';
    filterBtn.classList.toggle('active', !!activeFilter);
  }

  function renderFilter() {
    filterList.innerHTML = '';
    const rows = [{ name: 'Все цвета', dots: ['#e63950', '#2b76ba', '#c0e0c9'], all: true }]
      .concat(COLOR_GROUPS);
    rows.forEach((g) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'filter-row';
      const chosen = g.all ? !activeFilter : activeFilter === g.name;
      if (chosen) row.classList.add('chosen');

      const sw = document.createElement('span');
      sw.className = 'swatches';
      g.dots.forEach((c) => { const i = document.createElement('i'); i.style.background = c; sw.appendChild(i); });

      const nm = document.createElement('span');
      nm.className = 'name';
      nm.textContent = g.name;

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = g.all ? CARDS.length : cardsInGroup(g.name);

      row.appendChild(sw); row.appendChild(nm); row.appendChild(num);
      row.addEventListener('click', () => {
        activeFilter = g.all ? null : g.name;
        updateFilterUI();
        filterOverlay.classList.add('hidden');
        drawCard();               // сразу показываем карту из выбранной группы
      });
      filterList.appendChild(row);
    });
  }

  filterBtn.addEventListener('click', () => { renderFilter(); filterOverlay.classList.remove('hidden'); });
  filterClose.addEventListener('click', () => filterOverlay.classList.add('hidden'));
  filterOverlay.addEventListener('click', (e) => {
    if (e.target === filterOverlay) filterOverlay.classList.add('hidden');
  });

  // --- Каталог: все 49 карт сеткой ---
  let catalogBuilt = false;
  function renderCatalog() {
    if (catalogBuilt) return;        // карты не меняются — строим один раз
    CARDS.forEach((card, idx) => {
      const item = document.createElement('div');
      item.className = 'fav-item';
      const img = document.createElement('img');
      img.src = card.front;
      img.alt = 'Карта ' + (idx + 1);
      img.addEventListener('click', () => {
        catalogOverlay.classList.add('hidden');
        drawCard(idx);
      });
      item.appendChild(img);
      catalogGrid.appendChild(item);
    });
    catalogBuilt = true;
  }

  catalogBtn.addEventListener('click', () => { renderCatalog(); catalogOverlay.classList.remove('hidden'); });
  catalogClose.addEventListener('click', () => catalogOverlay.classList.add('hidden'));
  catalogOverlay.addEventListener('click', (e) => {
    if (e.target === catalogOverlay) catalogOverlay.classList.add('hidden');
  });

  // --- QR-код приложения (мастер показывает клиенту) ---
  const qrBtn = document.getElementById('qrBtn');
  const qrOverlay = document.getElementById('qrOverlay');
  const qrClose = document.getElementById('qrClose');
  qrBtn.addEventListener('click', () => qrOverlay.classList.remove('hidden'));
  qrClose.addEventListener('click', () => qrOverlay.classList.add('hidden'));
  qrOverlay.addEventListener('click', (e) => {
    if (e.target === qrOverlay) qrOverlay.classList.add('hidden');
  });

  // --- Карта дня: одна и та же для всех в течение дня, зависит от даты ---
  const dayBtn = document.getElementById('dayBtn');
  const dayBadge = document.getElementById('dayBadge');

  function cardOfDayIndex() {
    const d = new Date();
    const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    // детерминированный «перемешиватель», чтобы соседние дни не давали соседние карты
    const h = (key * 9301 + 49297) % 233280;
    return Math.floor((h / 233280) * CARDS.length) % CARDS.length;
  }

  function showCardOfDay() {
    drawCard(cardOfDayIndex());          // forced-индекс: показывается всегда
    dayBadge.classList.remove('hidden'); // бейдж поверх обычной отрисовки
    setHint('Карта дня · нажмите, чтобы увидеть послание');
  }

  dayBtn.addEventListener('click', showCardOfDay);

  function pickNewIndex() {
    const pool = filteredPool();
    if (pool.length === 1) return pool[0];
    let idx;
    do {
      idx = pool[Math.floor(Math.random() * pool.length)];
    } while (idx === currentIndex);
    return idx;
  }

  function drawCard(forcedIndex, fromHistory) {
    const forced = (typeof forcedIndex === 'number');
    // защита от «дребезга» нужна только для случайной тряски;
    // явный выбор (избранное, ссылка ?card=N) должен срабатывать всегда
    if (isAnimating && !forced) return;
    isAnimating = true;

    dayBadge.classList.add('hidden');   // любое вытягивание снимает бейдж «Карта дня»

    currentIndex = forced ? forcedIndex : pickNewIndex();
    const data = CARDS[currentIndex];

    if (!fromHistory) {
      // новая карта: всё, что было «впереди», отбрасываем и дописываем в конец
      history = history.slice(0, histPos + 1);
      history.push(currentIndex);
      if (history.length > HIST_MAX) history = history.slice(-HIST_MAX);
      histPos = history.length - 1;
    }
    updateHistoryUI();

    // отклик только когда карта именно выпала; шаги назад/вперёд — молча
    if (!fromHistory) { buzz(); playDraw(); }

    // если карта была перевёрнута - сначала вернуть на лицевую сторону
    isFlipped = false;
    cardEl.classList.remove('flipped');

    cardEl.classList.remove('drawing');
    // force reflow to restart animation
    void cardEl.offsetWidth;
    cardEl.classList.add('drawing');

    const preload = new Image();
    preload.onload = () => {
      frontImg.src = data.front;
      cardFrontEl.classList.remove('empty');
    };
    preload.src = data.front;
    phraseEl.textContent = data.phrase;

    // Кнопка «Примеры работ» — только если у карты есть фото работ
    currentWorks = Array.isArray(data.works) ? data.works : [];
    currentLabels = Array.isArray(data.workLabels) ? data.workLabels : [];
    if (currentWorks.length > 0) {
      workBtn.classList.remove('hidden');
    } else {
      workBtn.classList.add('hidden');
    }

    hasCard = true;
    likeBtn.classList.remove('hidden');
    shareBtn.classList.remove('hidden');
    updateFavUI();
    setHint('Нажмите на карту, чтобы увидеть послание');

    window.setTimeout(() => {
      isAnimating = false;
    }, 550);
  }

  function flipCard() {
    if (!hasCard || isAnimating) return;
    isFlipped = !isFlipped;
    cardEl.classList.toggle('flipped', isFlipped);
    setHint(isFlipped ? 'Потрясите телефон для новой карты' : 'Нажмите на карту, чтобы увидеть послание');
  }

  cardEl.addEventListener('click', flipCard);
  shakeBtn.addEventListener('click', () => drawCard());
  backBtn.addEventListener('click', goBack);
  fwdBtn.addEventListener('click', goForward);

  function renderDots() {
    workDots.innerHTML = '';
    currentWorks.forEach((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', 'Дизайн ' + (i + 1));
      if (i === workPos) d.classList.add('active');
      d.addEventListener('click', () => showWork(i));
      workDots.appendChild(d);
    });
  }

  // --- Зум фото: щипок двумя пальцами, двойной тап, перетаскивание ---
  const workStage = document.querySelector('.work-stage');
  let zScale = 1, zX = 0, zY = 0;
  let pinchDist0 = 0, pinchScale0 = 1;
  let panX0 = 0, panY0 = 0, panBaseX = 0, panBaseY = 0;
  let isPinching = false, isPanning = false, lastTap = 0;

  const isZoomed = () => zScale > 1.01;

  function applyZoom() {
    workImg.style.transform =
      'translate(' + zX + 'px,' + zY + 'px) scale(' + zScale + ')';
  }
  function resetZoom() {
    zScale = 1; zX = 0; zY = 0;
    workImg.classList.remove('gesture');
    applyZoom();
  }
  function clampPan() {
    const maxX = Math.max(0, (workImg.clientWidth * zScale - workStage.clientWidth) / 2);
    const maxY = Math.max(0, (workImg.clientHeight * zScale - workStage.clientHeight) / 2);
    zX = Math.max(-maxX, Math.min(maxX, zX));
    zY = Math.max(-maxY, Math.min(maxY, zY));
  }
  const fingerDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  workStage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isPinching = true; isPanning = false;
      pinchDist0 = fingerDist(e.touches[0], e.touches[1]);
      pinchScale0 = zScale;
      workImg.classList.add('gesture');
    } else if (e.touches.length === 1) {
      panX0 = e.touches[0].clientX; panY0 = e.touches[0].clientY;
      panBaseX = zX; panBaseY = zY;
      isPanning = isZoomed();
      const now = Date.now();
      if (now - lastTap < 300) {            // двойной тап — увеличить/вернуть
        zScale = isZoomed() ? 1 : 2.5;
        zX = 0; zY = 0;
        workImg.classList.remove('gesture');
        applyZoom();
        lastTap = 0;
      } else { lastTap = now; }
    }
  }, { passive: true });

  workStage.addEventListener('touchmove', (e) => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const d = fingerDist(e.touches[0], e.touches[1]);
      zScale = Math.max(1, Math.min(4, pinchScale0 * (d / pinchDist0)));
      if (!isZoomed()) { zX = 0; zY = 0; }
      clampPan(); applyZoom();
    } else if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      workImg.classList.add('gesture');
      zX = panBaseX + (e.touches[0].clientX - panX0);
      zY = panBaseY + (e.touches[0].clientY - panY0);
      clampPan(); applyZoom();
    }
  }, { passive: false });

  workStage.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) isPinching = false;
    if (e.touches.length === 0) {
      isPanning = false;
      workImg.classList.remove('gesture');
      if (!isZoomed()) resetZoom();
    }
  }, { passive: true });

  // Safari на iPhone шлёт пинч отдельными событиями gesture*
  let gestureScale0 = 1;
  workStage.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    gestureScale0 = zScale;
    workImg.classList.add('gesture');
  });
  workStage.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    zScale = Math.max(1, Math.min(4, gestureScale0 * e.scale));
    if (!isZoomed()) { zX = 0; zY = 0; }
    clampPan(); applyZoom();
  });
  workStage.addEventListener('gestureend', (e) => {
    e.preventDefault();
    workImg.classList.remove('gesture');
    if (!isZoomed()) resetZoom();
  });

  // Колесо мыши / трекпад — для проверки на компьютере
  workStage.addEventListener('wheel', (e) => {
    if (workOverlay.classList.contains('hidden')) return;
    e.preventDefault();
    zScale = Math.max(1, Math.min(4, zScale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    if (!isZoomed()) { zX = 0; zY = 0; }
    clampPan(); applyZoom();
  }, { passive: false });

  // Двойной клик мышью
  workStage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    zScale = isZoomed() ? 1 : 2.5;
    zX = 0; zY = 0;
    applyZoom();
  });

  function showWork(i) {
    if (i < 0 || i >= currentWorks.length) return;
    workPos = i;
    resetZoom();
    workImg.src = currentWorks[i];
    const label = currentLabels[i] || ('Дизайн ' + (i + 1));
    workCaption.innerHTML = label +
      '<span class="work-counter">' + (i + 1) + ' / ' + currentWorks.length + '</span>';
    workPrev.disabled = (i === 0);
    workNext.disabled = (i === currentWorks.length - 1);
    Array.prototype.forEach.call(workDots.children, (d, di) => {
      d.classList.toggle('active', di === workPos);
    });
  }

  function openWork() {
    if (workBtn.classList.contains('hidden') || currentWorks.length === 0) return;
    workPos = 0;
    renderDots();
    showWork(0);
    workOverlay.classList.remove('hidden');
  }
  function closeWork() {
    workOverlay.classList.add('hidden');
    resetZoom();
  }
  function nextWork() { showWork(Math.min(workPos + 1, currentWorks.length - 1)); }
  function prevWork() { showWork(Math.max(workPos - 1, 0)); }

  workBtn.addEventListener('click', openWork);
  workClose.addEventListener('click', closeWork);
  workNext.addEventListener('click', nextWork);
  workPrev.addEventListener('click', prevWork);
  workOverlay.addEventListener('click', (e) => {
    if (e.target === workOverlay) closeWork();
  });
  document.addEventListener('keydown', (e) => {
    if (workOverlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeWork();
    else if (e.key === 'ArrowRight') nextWork();
    else if (e.key === 'ArrowLeft') prevWork();
  });

  // Свайп для листания — только когда фото не увеличено
  let touchX = null;
  workOverlay.addEventListener('touchstart', (e) => {
    touchX = (e.touches.length === 1 && !isZoomed()) ? e.changedTouches[0].clientX : null;
  }, { passive: true });
  workOverlay.addEventListener('touchend', (e) => {
    if (touchX === null || isZoomed() || isPinching) { touchX = null; return; }
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { if (dx < 0) nextWork(); else prevWork(); }
    touchX = null;
  }, { passive: true });

  // --- Shake detection ---
  const SHAKE_THRESHOLD = 16; // m/s^2 суммарное изменение ускорения
  const SHAKE_COOLDOWN = 1200; // ms
  let lastShakeTime = 0;
  let lastAcc = null;

  function handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null) return;

    const now = Date.now();

    // Пока работает вибромотор, телефон трясётся сам — датчик это видит и
    // засчитывает за новую тряску. Получается петля: вибрация вызывает карту,
    // карта вызывает вибрацию. На это время показания просто не считаем.
    if (now < buzzUntil + BUZZ_SETTLE) {
      lastAcc = { x: acc.x, y: acc.y, z: acc.z };
      return;
    }

    if (lastAcc) {
      const delta =
        Math.abs(acc.x - lastAcc.x) +
        Math.abs(acc.y - lastAcc.y) +
        Math.abs(acc.z - lastAcc.z);

      if (delta > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN) {
        lastShakeTime = now;
        dbg('тряска: сила ' + delta.toFixed(1));
        drawCard();
      }
    }
    lastAcc = { x: acc.x, y: acc.y, z: acc.z };
  }

  function enableMotionListener() {
    window.addEventListener('devicemotion', handleMotion);
  }

  function needsIOSPermission() {
    return typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function';
  }

  if (needsIOSPermission()) {
    permBtn.classList.remove('hidden');
    permBtn.addEventListener('click', () => {
      DeviceMotionEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            enableMotionListener();
            permBtn.classList.add('hidden');
            setHint('Потрясите телефон, чтобы вытянуть карту');
          } else {
            setHint('Датчики недоступны — используйте кнопку «Тряхнуть колоду»');
          }
        })
        .catch(() => {
          setHint('Датчики недоступны — используйте кнопку «Тряхнуть колоду»');
        });
    });
  } else if (window.DeviceMotionEvent) {
    enableMotionListener();
  } else {
    setHint('Датчики недоступны — используйте кнопку «Тряхнуть колоду»');
  }

  // Показать счётчик избранного, если что-то сохранено с прошлого раза
  updateFavUI();
  updateHistoryUI();   // на старте обе стрелки погашены — истории ещё нет

  // Прямой переход к карте по ссылке ?card=N — открыть нужную карту без тряски (для просмотра).
  // Если ссылки нет — встречаем пользователя картой дня.
  const cardParam = parseInt(new URLSearchParams(window.location.search).get('card'), 10);
  if (cardParam >= 1 && cardParam <= CARDS.length) {
    drawCard(cardParam - 1);
  } else {
    showCardOfDay();
  }

  canBuzz = true;   // дальше уже настоящие вытягивания — можно жужжать

  dbg('вибрация в браузере: ' + (typeof navigator.vibrate === 'function' ? 'есть' : 'НЕТ') +
      ' | узор ' + BUZZ_PATTERN.join('-') + ' (' + BUZZ_MS + 'мс)' +
      ' | датчик глушится на ' + (BUZZ_MS + BUZZ_SETTLE) + 'мс');
  dbg('звук: Web Audio ' + ((window.AudioContext || window.webkitAudioContext) ? 'есть' : 'НЕТ') +
      ' | звук ' + (muted ? 'ВЫКЛ' : 'вкл') + ' | коснитесь экрана для разблокировки');
})();
