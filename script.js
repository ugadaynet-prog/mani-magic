// В native-сборке (Capacitor/RuStore) файлы и так локальные внутри приложения —
// service worker там не нужен и только усложнил бы обновление версий.
if ('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
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

// --- Заставка: показываем не меньше секунды, потом плавно убираем ---
(function () {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const MIN_MS = 1800;          // держим, чтобы успеть прочитать слоган
  const MAX_MS = 3500;          // страховка, если что-то грузится долго
  const started = Date.now();
  let done = false;

  function hide() {
    if (done) return;
    done = true;
    const wait = Math.max(0, MIN_MS - (Date.now() - started));
    setTimeout(() => {
      splash.classList.add('hiding');
      setTimeout(() => { if (splash.parentNode) splash.remove(); }, 500);
    }, wait);
  }

  if (document.readyState === 'complete') hide();
  else window.addEventListener('load', hide);
  setTimeout(hide, MAX_MS);
})();

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
  const shareSelBtn = document.getElementById('shareSelBtn');
  const selOverlay = document.getElementById('selOverlay');
  const selClose = document.getElementById('selClose');
  const selGrid = document.getElementById('selGrid');
  const selCount = document.getElementById('selCount');
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
  const lockBanner = document.getElementById('lockBanner');
  const lockBannerText = document.getElementById('lockBannerText');
  const paywallOverlay = document.getElementById('paywallOverlay');
  const paywallClose = document.getElementById('paywallClose');
  const pwBuyBtn = document.getElementById('pwBuyBtn');

  // Подписи дизайнов берутся из карты (workLabels). Если их нет — просто «Дизайн N».
  let currentLabels = [];

  // --- Подписка ---
  // Пока сервер не подключён (SERVER_URL пуст, см. ниже) — это «мягкий» пейволл:
  // всё приложение статическое, карты и фото лежат в коде, запрет только на уровне
  // интерфейса. Когда включён SERVER_URL, статус подписки берётся с сервера (источник
  // правды). Полная защита картинок появится, когда платные карты переедут в хранилище
  // сервера и будут отдаваться по пропуску — это делается вместе с развёртыванием.
  const PLAN_KEY = 'maniMagicPlan';          // 'free' | 'full' | 'pro'
  let plan = 'free';
  try {
    const p = localStorage.getItem(PLAN_KEY);
    if (p === 'full' || p === 'pro') plan = p;
  } catch (e) {}

  // Демо-разблокировка для показов: ?unlock=1 включает, ?unlock=0 выключает
  try {
    const u = new URLSearchParams(location.search).get('unlock');
    if (u === '1' || u === 'pro') { plan = (u === 'pro') ? 'pro' : 'full'; localStorage.setItem(PLAN_KEY, plan); }
    if (u === '0') { plan = 'free'; localStorage.setItem(PLAN_KEY, 'free'); }
  } catch (e) {}

  const isPaid = () => plan !== 'free';

  // 15 бесплатных карт, равномерно по колоде — чтобы бесплатный набор был
  // разноцветным, а не первыми пятнадцатью подряд
  const FREE_CARDS = [0, 3, 7, 10, 14, 17, 21, 24, 27, 31, 34, 38, 41, 45, 48];
  const isFree = (idx) => isPaid() || FREE_CARDS.indexOf(idx) !== -1;

  // --- Связь с сервером (за выключателем) ---------------------------------
  // По умолчанию SERVER_URL пуст → приложение работает как раньше и НИКУДА не
  // ходит: живая версия не ломается. Когда сервер развёрнут — впишите его адрес
  // в DEFAULT_SERVER_URL. Для разовой проверки можно открыть приложение с
  // ?server=https://адрес (этим же пользуемся при локальном тесте).
  const DEFAULT_SERVER_URL = 'https://api.mani-magic.ru';
  let SERVER_URL = DEFAULT_SERVER_URL;
  try {
    const s = new URLSearchParams(location.search).get('server');
    // ?server= разрешаем только для локальной проверки (localhost) или если это тот же
    // адрес, что зашит по умолчанию. Иначе чужая ссылка не сможет увести оплату
    // на посторонний сервер.
    if (s && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(s) || s === DEFAULT_SERVER_URL)) {
      SERVER_URL = s;
    }
  } catch (e) {}
  SERVER_URL = (SERVER_URL || '').replace(/\/+$/, '');
  const serverOn = () => !!SERVER_URL;
  // ?dev=1 — только для нашей проверки: имитировать оплату в тестовом режиме.
  // Без него в тестовом режиме кнопка честно пишет «оплата скоро», без «бесплатной» разблокировки.
  let DEV_MOCK = false;
  try { DEV_MOCK = new URLSearchParams(location.search).get('dev') === '1'; } catch (e) {}

  // Нативная сборка RuStore (Capacitor): там оплата идёт через RuStore Pay SDK,
  // а не через ЮKassa — сторы не разрешают внешние платежи за цифровой товар внутри
  // приложения. window.Capacitor есть только в собранном native-приложении.
  const isNativeApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  // Анонимный идентификатор устройства — к нему привязана подписка (без аккаунтов).
  const DEVICE_KEY = 'maniMagicDevice';
  let deviceId = '';
  try {
    deviceId = localStorage.getItem(DEVICE_KEY) || '';
    if (!deviceId) {
      deviceId = 'd_' + ((window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
  } catch (e) {}

  const PENDING_KEY = 'maniMagicPending';   // id платежа, пока ждём возврата с оплаты
  const EMAIL_KEY = 'maniMagicEmail';       // email для чека — запоминаем, чтобы не вводить каждый раз
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let accessPass = null;                    // JWT-пропуск активной подписки
  let selectedPlanKey = 'full_year';        // какой тариф выбран в окне подписки

  function api(path, opts) {
    return fetch(SERVER_URL + path, opts).then((r) => {
      if (!r.ok) {
        // Текст ошибки оставляем прежним (на него смотрят все старые вызовы),
        // но добавляем код от сервера — по нему показываем человеку причину.
        return r.json().catch(() => ({})).then((body) => {
          const err = new Error('http ' + r.status);
          err.status = r.status;
          err.code = body && body.error;
          throw err;
        });
      }
      return r.json();
    });
  }

  // Пере-применяет части интерфейса, зависящие от подписки: после ответа сервера
  // или оплаты план может измениться уже во время работы приложения.
  function applyPlanUI() {
    catalogBuilt = null;
    if (catalogOverlay && !catalogOverlay.classList.contains('hidden')) renderCatalog();
    lockBanner.classList.toggle('hidden', isPaid());
  }

  // Одноразовый код из кабинета мастера (?pass=...) — меняем на пропуск для
  // этого устройства. Код сгорает сразу, поэтому чистим его из адресной строки,
  // чтобы обновление страницы не выглядело как ошибка.
  function redeemDeckPass() {
    let code = '';
    try { code = new URLSearchParams(location.search).get('pass') || ''; } catch (e) {}
    if (!code || !serverOn() || !deviceId) return Promise.resolve();
    return api('/api/deck-pass/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, deviceId: deviceId }),
    })
      .then(() => dbg('пропуск мастера получен'))
      .catch((e) => dbg('пропуск: ' + e.message))
      .then(() => {
        try {
          const u = new URL(location.href);
          u.searchParams.delete('pass');
          history.replaceState(null, '', u.toString());
        } catch (e) {}
      });
  }

  // Клиент открыл страницу студии по QR: пока у мастера активен Pro, колода
  // открывается на сутки. Отказ (нет Pro / лимит) — не ошибка, просто остаются
  // бесплатные карты.
  function requestGuestPass() {
    if (!masterMode() || !deviceId || isPaid()) return Promise.resolve();
    return api('/api/m/' + encodeURIComponent(masterSlug) + '/guest-pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId }),
    })
      .then(() => dbg('гостевой пропуск выдан'))
      .catch((e) => dbg('гостевой пропуск: ' + e.message));
  }

  // Спросить у сервера статус подписки. Сервер — источник правды.
  function refreshAccess() {
    if (!serverOn() || !deviceId) return Promise.resolve();
    return api('/api/access?deviceId=' + encodeURIComponent(deviceId))
      .then((a) => {
        if (a.plan === 'full' || a.plan === 'pro') {
          plan = a.plan;
          accessPass = a.pass || null;
          try { localStorage.setItem(PLAN_KEY, plan); } catch (e) {}
        } else {
          plan = 'free';
          accessPass = null;
          try { localStorage.setItem(PLAN_KEY, 'free'); } catch (e) {}
        }
        applyPlanUI();
        dbg('доступ: ' + plan);
      })
      .catch((e) => dbg('доступ: ошибка ' + e.message));
  }

  // Оформление подписки. В тестовом режиме сервер отвечает mock:true — тогда
  // имитируем успешную оплату и сразу проверяем доступ. В бою уводим на ЮKassa.
  // В native-сборке RuStore — свой путь через RuStore Pay SDK (см. startNativeCheckout).
  function startCheckout() {
    if (!serverOn()) return;
    if (isNativeApp()) return startNativeCheckout();

    // ЮKassa требует чек (54-ФЗ) с email покупателя — без него платёж не создать.
    const pwEmail = document.getElementById('pwEmail');
    const pwEmailError = document.getElementById('pwEmailError');
    const email = pwEmail ? pwEmail.value.trim() : '';
    if (!EMAIL_RE.test(email)) {
      if (pwEmailError) pwEmailError.classList.remove('hidden');
      if (pwEmail) pwEmail.focus();
      return;
    }
    if (pwEmailError) pwEmailError.classList.add('hidden');
    try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}

    pwBuyBtn.disabled = true;
    const label = pwBuyBtn.textContent;
    pwBuyBtn.textContent = 'Открываем оплату…';
    track('checkout_start', { planKey: selectedPlanKey });
    api('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey: selectedPlanKey, deviceId: deviceId, email: email }),
    }).then((r) => {
      if (r.mock) {
        if (DEV_MOCK) {   // наша проверка: имитируем успешную оплату
          return api('/api/dev/complete-mock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: r.paymentId }),
          }).then(refreshAccess).then(onPurchaseMaybeDone);
        }
        toast('Приём оплаты скоро подключится');   // ключей ЮKassa ещё нет
        return;
      }
      if (r.confirmationUrl) {
        try { localStorage.setItem(PENDING_KEY, r.paymentId); } catch (e) {}
        location.href = r.confirmationUrl;   // уходим на страницу оплаты ЮKassa
      }
    }).catch((e) => {
      toast('Не получилось открыть оплату');
      dbg('оплата: ' + e.message);
    }).finally(() => {
      pwBuyBtn.disabled = false;
      pwBuyBtn.textContent = label;
    });
  }

  function onPurchaseMaybeDone() {
    if (isPaid()) {
      paywallOverlay.classList.add('hidden');
      toast('Готово! Открыта вся колода 💅');
      track('purchase_done', { plan: plan });
    }
  }

  // --- Вход мастера по коду из кабинета ---
  // Отдельно от ссылки ?pass= : на iPhone у приложения с экрана «Домой» своё
  // хранилище, отдельное от Safari, поэтому пропуск, полученный в браузере,
  // в установленное приложение не переносится — код вводится уже внутри него.
  const pwMasterToggle = document.getElementById('pwMasterToggle');
  const pwMasterBox = document.getElementById('pwMasterBox');
  const pwMasterCode = document.getElementById('pwMasterCode');
  const pwMasterBtn = document.getElementById('pwMasterBtn');
  const pwMasterMsg = document.getElementById('pwMasterMsg');

  const MASTER_CODE_ERRORS = {
    invalid_code: 'Код не найден — проверьте, нет ли опечатки',
    code_used: 'Этот код уже использован. Возьмите новый в кабинете',
    code_expired: 'Код истёк. Возьмите новый в кабинете',
    no_pro: 'Подписка Pro не активна',
    no_device: 'Не удалось определить устройство',
  };

  if (pwMasterToggle) {
    pwMasterToggle.addEventListener('click', () => {
      pwMasterBox.classList.toggle('hidden');
      if (!pwMasterBox.classList.contains('hidden')) pwMasterCode.focus();
    });
  }
  if (pwMasterBtn) {
    pwMasterBtn.addEventListener('click', () => {
      const code = (pwMasterCode.value || '').trim();
      pwMasterMsg.classList.add('hidden');
      if (!code) { showMasterMsg('Введите код из кабинета'); return; }
      if (!serverOn()) { showMasterMsg('Нет связи с сервером'); return; }
      pwMasterBtn.disabled = true;
      api('/api/deck-pass/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, deviceId: deviceId }),
      })
        .then(() => refreshAccess())
        .then(() => {
          if (isPaid()) {
            paywallOverlay.classList.add('hidden');
            toast('Готово! Колода открыта 💅');
          } else {
            showMasterMsg('Не получилось открыть колоду');
          }
        })
        .catch((e) => showMasterMsg(MASTER_CODE_ERRORS[e.code] || 'Код не подошёл'))
        .finally(() => { pwMasterBtn.disabled = false; });
    });
  }
  function showMasterMsg(text) {
    pwMasterMsg.textContent = text;
    pwMasterMsg.classList.remove('hidden');
  }

  // --- Установка приложения на телефон ---
  // Android/Chrome отдаёт событие beforeinstallprompt — показываем свою кнопку.
  // Safari на iPhone такого события не даёт вообще, там только ручное
  // «Поделиться → На экран „Домой“», поэтому для него — подсказка.
  let installEvent = null;
  const installBtn = document.getElementById('installBtn');
  const installHint = document.getElementById('installHint');

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS притворяется Mac

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    if (installBtn && !isStandalone()) installBtn.classList.remove('hidden');
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      const res = await installEvent.userChoice.catch(() => null);
      track('app_install', { outcome: res ? res.outcome : 'unknown' });
      installEvent = null;
      installBtn.classList.add('hidden');
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.classList.add('hidden');
    if (installHint) installHint.classList.add('hidden');
  });

  // Уже установленному приложению подсказка не нужна
  if (installHint && isIOS() && !isStandalone()) installHint.classList.remove('hidden');

  // Покупка внутри Android-приложения (RuStore Pay SDK через нативный плагин
  // RuStoreBilling). planKey используется и как id товара в консоли RuStore —
  // те же ключи, что и в PLANS на сервере (full_month/full_year/pro_month/pro_year).
  // Сервер НЕ верит клиенту на слово: сам проверяет покупку через Public API RuStore,
  // прежде чем выдать подписку (см. /api/rustore/grant).
  function startNativeCheckout() {
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RuStoreBilling;
    if (!plugin) { toast('Оплата недоступна в этой сборке'); return; }
    pwBuyBtn.disabled = true;
    const label = pwBuyBtn.textContent;
    pwBuyBtn.textContent = 'Открываем оплату…';
    track('checkout_start', { planKey: selectedPlanKey, native: true });
    plugin.purchaseProduct({ productId: selectedPlanKey })
      .then((result) => api('/api/rustore/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceId, planKey: selectedPlanKey,
          purchaseId: result.purchaseId, invoiceId: result.invoiceId, sandbox: !!result.sandbox,
        }),
      }))
      .then(refreshAccess)
      .then(onPurchaseMaybeDone)
      .catch((e) => {
        if (e && e.message && /cancel/i.test(e.message)) return;   // пользователь просто передумал
        toast('Не получилось оформить оплату');
        dbg('RuStore оплата: ' + (e && e.message));
      })
      .finally(() => {
        pwBuyBtn.disabled = false;
        pwBuyBtn.textContent = label;
      });
  }

  // Вернулись с оплаты ЮKassa — несколько раз спросим статус, пока подписка «доедет».
  function resumePendingPayment() {
    if (!serverOn()) return;
    let pending = '';
    try { pending = localStorage.getItem(PENDING_KEY) || ''; } catch (e) {}
    if (!pending) return;
    let tries = 0;
    const tick = () => {
      refreshAccess().then(() => {
        if (isPaid()) {
          try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
          onPurchaseMaybeDone();
        } else if (++tries < 5) {
          setTimeout(tick, 1500);
        } else {
          try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
        }
      });
    };
    tick();
  }

  // --- Режим мастера (страница открыта по QR мастера: ?master=slug) ---------
  let masterSlug = '';
  try { masterSlug = new URLSearchParams(location.search).get('master') || ''; } catch (e) {}
  const masterMode = () => serverOn() && !!masterSlug;

  // Пришёл ли сюда сам мастер из кабинета (в ссылке был одноразовый код).
  // Запоминаем: код из адреса стирается сразу, а кнопка «В кабинет» должна
  // пережить перезагрузку страницы.
  const FROM_CABINET_KEY = 'maniMagicFromCabinet';
  let cameFromCabinet = false;
  try {
    if (new URLSearchParams(location.search).get('pass')) {
      cameFromCabinet = true;
      sessionStorage.setItem(FROM_CABINET_KEY, '1');
    } else {
      cameFromCabinet = sessionStorage.getItem(FROM_CABINET_KEY) === '1';
    }
  } catch (e) {}
  const CABINET_URL = 'https://api.mani-magic.ru/master/';
  let masterWorks = [];   // фото работ мастера — для витрины клиенту

  // У мастера может быть ещё не задан адрес студии — тогда ?master= в ссылке нет
  // и плашка не рисуется. Возврат в кабинет всё равно должен быть.
  function renderBackBarOnly() {
    const bar = document.createElement('div');
    bar.className = 'master-bar';
    const info = document.createElement('div');
    info.className = 'mb-info';
    const name = document.createElement('span');
    name.className = 'mb-name';
    name.textContent = 'Ваша колода';
    info.appendChild(name);
    const actions = document.createElement('div');
    actions.className = 'mb-actions';
    const back = document.createElement('a');
    back.className = 'mb-back';
    back.href = CABINET_URL;
    back.textContent = 'В кабинет';
    actions.appendChild(back);
    bar.appendChild(info); bar.appendChild(actions);
    document.body.appendChild(bar);
    document.body.classList.add('has-master-bar');
  }

  function initMasterMode() {
    if (!masterMode()) {
      if (cameFromCabinet) renderBackBarOnly();
      return;
    }
    api('/api/m/' + encodeURIComponent(masterSlug))
      .then((r) => {
        const m = r.master || {};
        masterWorks = (Array.isArray(m.works) ? m.works : [])
          .map((u) => (/^https?:/.test(u) ? u : SERVER_URL + u));
        renderMasterBar(m);
        track('master_open', { slug: masterSlug });
      })
      .catch((e) => dbg('мастер: ' + e.message));
  }

  function renderMasterBar(m) {
    if (!m) return;
    if (m.accent) document.documentElement.style.setProperty('--master-accent', m.accent);
    const bar = document.createElement('div');
    bar.className = 'master-bar';

    const info = document.createElement('div');
    info.className = 'mb-info';
    const name = document.createElement('span');
    name.className = 'mb-name';
    name.textContent = m.studioName || 'Мастер';
    info.appendChild(name);
    if (m.city) {
      const city = document.createElement('span');
      city.className = 'mb-city';
      city.textContent = m.city;
      info.appendChild(city);
    }
    bar.appendChild(info);

    // кнопки справа: витрина работ и запись
    const actions = document.createElement('div');
    actions.className = 'mb-actions';
    if (masterWorks.length) {
      const w = document.createElement('button');
      w.type = 'button';
      w.className = 'mb-works';
      w.textContent = 'Работы';
      w.addEventListener('click', openMasterWorks);
      actions.appendChild(w);
    }
    if (m.bookingUrl) {
      const book = document.createElement('a');
      book.className = 'mb-book';
      book.href = m.bookingUrl;
      book.target = '_blank';
      book.rel = 'noopener';
      book.textContent = 'Записаться';
      book.addEventListener('click', () => track('master_book', { slug: masterSlug }));
      actions.appendChild(book);
    }
    // Кнопка обратно — только самому мастеру (пришёл из кабинета по пропуску),
    // клиенту в салоне она не нужна и только путала бы.
    if (cameFromCabinet) {
      const back = document.createElement('a');
      back.className = 'mb-back';
      back.href = CABINET_URL;
      back.textContent = 'В кабинет';
      actions.appendChild(back);
    }
    bar.appendChild(actions);

    document.body.appendChild(bar);
    document.body.classList.add('has-master-bar');
  }

  // --- Витрина работ мастера (галерея + просмотр по тапу) ---
  function openMasterWorks() {
    const grid = document.getElementById('mwGrid');
    grid.innerHTML = '';
    masterWorks.forEach((url) => {
      const img = document.createElement('img');
      img.src = url; img.alt = 'Работа мастера';
      img.addEventListener('click', () => openLightbox(url));
      grid.appendChild(img);
    });
    document.getElementById('masterWorksOverlay').classList.remove('hidden');
    track('master_works_open', { slug: masterSlug, count: masterWorks.length });
  }
  function closeMasterWorks() { document.getElementById('masterWorksOverlay').classList.add('hidden'); }
  function openLightbox(url) {
    document.getElementById('mwBig').src = url;
    document.getElementById('mwLightbox').classList.remove('hidden');
  }
  function closeLightbox() {
    document.getElementById('mwLightbox').classList.add('hidden');
    document.getElementById('mwBig').src = '';
  }
  document.getElementById('mwClose').addEventListener('click', closeMasterWorks);
  document.getElementById('masterWorksOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'masterWorksOverlay') closeMasterWorks();
  });
  document.getElementById('mwLightbox').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('mwLightbox').classList.contains('hidden')) closeLightbox();
    else if (!document.getElementById('masterWorksOverlay').classList.contains('hidden')) closeMasterWorks();
  });

  // Клиент в режиме мастера вытянул карту — тихо сообщаем мастеру (для «что выбрал клиент»).
  function recordMasterPick(cardIndex) {
    if (!masterMode()) return;
    api('/api/m/' + encodeURIComponent(masterSlug) + '/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: cardIndex + 1 }),
    }).catch(() => {});
  }

  // --- Закрытые карты с сервера ---------------------------------------------
  // Платные карты у подписчика грузятся не из бандла, а по временным подписанным
  // ссылкам с сервера (настоящая защита картинок). Бесплатные всегда лежат в
  // приложении. Пока картинки ещё и в бандле — если сервер не ответил, тихо
  // показываем карту из бандла, ничего не ломая.
  let drawSeq = 0;                    // номер последнего вытягивания (защита от гонок)
  const serverMediaCache = {};        // index -> {front, works} | false

  async function serverCardMedia(index) {
    if (!serverOn() || !isPaid() || !accessPass) return null;
    if (FREE_CARDS.indexOf(index) !== -1) return null;      // бесплатные — из бандла
    if (serverMediaCache[index]) return serverMediaCache[index];
    if (serverMediaCache[index] === false) return null;
    const n = index + 1;
    try {
      const hdr = () => ({ Authorization: 'Bearer ' + accessPass });
      let r = await fetch(SERVER_URL + '/api/content/card/' + n, { headers: hdr() });
      if (r.status === 401) {                                // пропуск устарел — обновить и повторить
        await refreshAccess();
        if (!accessPass) return null;
        r = await fetch(SERVER_URL + '/api/content/card/' + n, { headers: hdr() });
      }
      if (!r.ok) { serverMediaCache[index] = false; return null; }
      const d = await r.json();
      const bundleWorks = Array.isArray(CARDS[index].works) ? CARDS[index].works.length : 0;
      const media = {
        front: SERVER_URL + d.front,
        // берём столько работ, сколько реально есть у карты (сервер отдаёт до 5)
        works: (Array.isArray(d.works) ? d.works : []).slice(0, bundleWorks).map((w) => SERVER_URL + w),
      };
      serverMediaCache[index] = media;
      return media;
    } catch (e) { dbg('карта с сервера: ' + e.message); return null; }
  }

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
    track(at === -1 ? 'like' : 'unlike', { card: currentIndex + 1 });
    if (at === -1) favorites.push(currentIndex); else favorites.splice(at, 1);
    saveFavorites();
    updateFavUI();
  }

  function renderFavorites() {
    favGrid.innerHTML = '';
    favEmpty.classList.toggle('hidden', favorites.length > 0);
    shareSelBtn.classList.toggle('hidden', favorites.length === 0);
    favorites.forEach((idx) => {
      const item = document.createElement('div');
      item.className = 'fav-item';

      const img = document.createElement('img');
      img.src = CARDS[idx].front;
      img.alt = 'Карта ' + (idx + 1);
      img.addEventListener('click', () => {
        favOverlay.classList.add('hidden');
        drawSource = 'favorites';
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
    track('share_card', { card: currentIndex + 1 });
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

  // --- Подборка: несколько карт одной ссылкой (?cards=7,19,33) ---
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function shareSelection() {
    if (favorites.length === 0) return;
    track('share_selection', { cards: favorites.length });
    const nums = favorites.map((i) => i + 1).join(',');
    const url = location.origin + location.pathname + '?cards=' + nums;
    const n = favorites.length;
    const text = 'Моя подборка: ' + n + ' ' + plural(n, 'карта', 'карты', 'карт') + ' 💅';
    const payload = { title: 'MANI Magic — подборка', text, url };

    if (navigator.share) { navigator.share(payload).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast('Ссылка на подборку скопирована'))
        .catch(() => toast(url));
      return;
    }
    toast(url);
  }

  shareSelBtn.addEventListener('click', shareSelection);

  // Разбор ссылки: только существующие номера, без повторов, максимум 49
  function parseSelection(raw) {
    if (!raw) return [];
    const seen = {};
    return raw.split(',')
      .map((s) => parseInt(s, 10) - 1)
      .filter((i) => Number.isInteger(i) && i >= 0 && i < CARDS.length &&
        !seen[i] && (seen[i] = true))
      .slice(0, CARDS.length);
  }

  function renderSelection(list) {
    selGrid.innerHTML = '';
    selCount.textContent = list.length + ' ' + plural(list.length, 'карта', 'карты', 'карт');
    list.forEach((idx) => {
      const item = document.createElement('div');
      item.className = 'fav-item';
      const img = document.createElement('img');
      img.src = CARDS[idx].front;
      img.alt = 'Карта ' + (idx + 1);
      img.addEventListener('click', () => {
        selOverlay.classList.add('hidden');
        drawSource = 'selection';
        drawCard(idx);
      });
      item.appendChild(img);
      selGrid.appendChild(item);
    });
  }

  selClose.addEventListener('click', () => selOverlay.classList.add('hidden'));
  selOverlay.addEventListener('click', (e) => {
    if (e.target === selOverlay) selOverlay.classList.add('hidden');
  });

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
  let drawSource = 'shake';   // откуда пришло вытягивание: shake/button/catalog/favorites/selection/day/link/filter

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

  // --- Аналитика ---
  // Слой событий, не привязанный к поставщику: код приложения всегда зовёт track(),
  // а куда это уйдёт — решается здесь одной настройкой.
  //
  // Для ВЕБА (эта версия) нужен номер счётчика Яндекс Метрики — вписать в METRICA_ID.
  // AppMetrica сюда не подходит: у неё нет браузерного SDK, только Android/iOS/Unity/
  // Flutter/React Native. Ключ AppMetrica для RuStore-обёртки (TWA):
  //   b3ad5749-3bbe-41af-a573-443bf81c34cc
  const METRICA_ID = 111151437;
  const trackLog = [];              // последние события, видны при ?debug=1

  function loadMetrica(id) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = +new Date();
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.appendChild(s);
    // webvisor включён при создании счётчика в кабинете — держим в коде то же самое.
    window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  if (METRICA_ID) loadMetrica(METRICA_ID);

  function track(event, params) {
    trackLog.push({ event, params: params || null, t: Date.now() });
    if (trackLog.length > 300) trackLog.shift();
    dbg('событие: ' + event + (params ? ' ' + JSON.stringify(params) : ''));
    if (METRICA_ID && typeof window.ym === 'function') {
      try { window.ym(METRICA_ID, 'reachGoal', event, params || undefined); } catch (e) {}
    }
  }
  window.__maniEvents = trackLog;   // чтобы можно было посмотреть события при проверке

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
    let pool;
    if (!activeFilter) {
      pool = CARDS.map((_, i) => i);
    } else {
      pool = [];
      CARDS.forEach((c, i) => {
        if (c.colors && c.colors.indexOf(activeFilter) !== -1) pool.push(i);
      });
      if (!pool.length) pool = CARDS.map((_, i) => i);
    }
    // без подписки тряска достаёт только из бесплатных карт;
    // карта дня и открытые по ссылке карты этим не ограничены — они как раз показывают, чего не хватает
    if (!isPaid()) {
      const free = pool.filter(isFree);
      if (free.length) pool = free;
    }
    return pool;
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
        track('filter_apply', { color: activeFilter || 'all' });
        updateFilterUI();
        filterOverlay.classList.add('hidden');
        drawSource = 'filter';

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
  let catalogBuilt = null;   // хранит план, под который построена сетка
  function renderCatalog() {
    // перестраиваем, если статус подписки изменился — иначе замки останутся висеть
    if (catalogBuilt === plan) return;
    catalogGrid.innerHTML = '';
    CARDS.forEach((card, idx) => {
      const item = document.createElement('div');
      item.className = 'fav-item';
      const locked = !isFree(idx);
      if (locked) item.classList.add('locked');

      const img = document.createElement('img');
      img.src = card.front;
      img.alt = 'Карта ' + (idx + 1) + (locked ? ' (по подписке)' : '');
      img.addEventListener('click', () => {
        if (locked) {                            // закрытая карта ведёт на подписку
          track('locked_card_tap', { card: idx + 1 });
          openPaywall('locked_card');
          return;
        }
        catalogOverlay.classList.add('hidden');
        drawSource = 'catalog';
        drawCard(idx);
      });
      item.appendChild(img);
      catalogGrid.appendChild(item);
    });
    lockBanner.classList.toggle('hidden', isPaid());
    lockBannerText.textContent = 'Открыто ' + FREE_CARDS.length + ' из ' + CARDS.length + ' карт';
    catalogBuilt = plan;
  }

  // --- Экран подписки ---
  function openPaywall(from) {
    track('paywall_show', { from: from || 'unknown' });   // ключевая метрика воронки
    catalogOverlay.classList.add('hidden');
    paywallOverlay.classList.remove('hidden');
  }

  paywallClose.addEventListener('click', () => paywallOverlay.classList.add('hidden'));
  paywallOverlay.addEventListener('click', (e) => {
    if (e.target === paywallOverlay) paywallOverlay.classList.add('hidden');
  });
  lockBanner.addEventListener('click', () => openPaywall('banner'));

  // Выбор тарифа и кнопка оплаты. Пока сервер не подключён (serverOn() === false)
  // — всё как раньше: кнопка выключена, снизу подпись «оплата подключается».
  (function wirePaywall() {
    const planEls = Array.prototype.slice.call(document.querySelectorAll('#pwPlans .pw-plan'));
    const pwSoon = document.getElementById('pwSoon');
    const pwEmail = document.getElementById('pwEmail');
    const pwEmailError = document.getElementById('pwEmailError');
    if (pwEmail) {
      try { pwEmail.value = localStorage.getItem(EMAIL_KEY) || ''; } catch (e) {}
      pwEmail.addEventListener('input', () => { if (pwEmailError) pwEmailError.classList.add('hidden'); });
    }

    function selectPlan(key) {
      selectedPlanKey = key;
      planEls.forEach((el) => el.classList.toggle('pw-sel', el.dataset.planKey === key));
    }

    if (serverOn()) {
      planEls.forEach((el) => {
        el.classList.add('selectable');
        if (!el.querySelector('.pw-check')) {
          const c = document.createElement('span');
          c.className = 'pw-check';
          el.appendChild(c);
        }
        el.addEventListener('click', () => selectPlan(el.dataset.planKey));
      });
      selectPlan(selectedPlanKey);
      if (pwSoon) pwSoon.classList.add('hidden');
      pwBuyBtn.disabled = false;
      pwBuyBtn.addEventListener('click', startCheckout);
    } else {
      // платежи ещё не подключены — кнопка не должна делать вид, что что-то произошло
      pwBuyBtn.disabled = true;
    }
  })();

  catalogBtn.addEventListener('click', () => {
    track('catalog_open');
    renderCatalog();
    catalogOverlay.classList.remove('hidden');
  });
  catalogClose.addEventListener('click', () => catalogOverlay.classList.add('hidden'));
  catalogOverlay.addEventListener('click', (e) => {
    if (e.target === catalogOverlay) catalogOverlay.classList.add('hidden');
  });

  // --- QR-код приложения (мастер показывает клиенту) ---
  const qrBtn = document.getElementById('qrBtn');
  const qrOverlay = document.getElementById('qrOverlay');
  const qrClose = document.getElementById('qrClose');
  qrBtn.addEventListener('click', () => { track('qr_open'); qrOverlay.classList.remove('hidden'); });
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
    drawSource = 'day';
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

    // главное событие воронки: как именно человек получил карту
    if (!fromHistory) {
      track('card_draw', { card: currentIndex + 1, source: drawSource, paid: isPaid() });
      recordMasterPick(currentIndex);   // в режиме мастера — сообщить, что выбрал клиент
    }
    drawSource = 'shake';   // источник по умолчанию для следующего вытягивания

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

    const drawToken = ++drawSeq;   // чтобы поздний ответ сервера не «прилетел» на другую карту

    const preload = new Image();
    preload.onload = () => {
      if (drawToken !== drawSeq) return;
      frontImg.src = data.front;
      cardFrontEl.classList.remove('empty');
    };
    preload.src = data.front;
    phraseEl.textContent = data.phrase;

    // Кнопка «Примеры работ» — только если у карты есть фото работ
    currentWorks = Array.isArray(data.works) ? data.works.slice() : [];
    currentLabels = Array.isArray(data.workLabels) ? data.workLabels : [];
    if (currentWorks.length > 0) {
      workBtn.classList.remove('hidden');
    } else {
      workBtn.classList.add('hidden');
    }

    // Платная карта у подписчика: лицо и работы подменяем на защищённые ссылки
    // с сервера, когда они придут (если за это время не вытянули другую карту).
    serverCardMedia(currentIndex).then((media) => {
      if (!media || drawToken !== drawSeq) return;
      const p = new Image();
      p.onload = () => { if (drawToken === drawSeq) frontImg.src = media.front; };
      p.src = media.front;
      if (media.works.length) currentWorks = media.works;
    });

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
  shakeBtn.addEventListener('click', () => { drawSource = 'button'; drawCard(); });
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
    track('gallery_open', { card: currentIndex + 1 });
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
        drawSource = 'shake';
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
  const params = new URLSearchParams(window.location.search);
  const cardParam = parseInt(params.get('card'), 10);
  const selection = parseSelection(params.get('cards'));
  if (cardParam >= 1 && cardParam <= CARDS.length) {
    drawSource = 'link';
    drawCard(cardParam - 1);
  } else if (selection.length > 0) {
    // пришли по ссылке-подборке: показываем её, за ней открыта первая карта
    drawSource = 'link_selection';
    drawCard(selection[0]);
    renderSelection(selection);
    selOverlay.classList.remove('hidden');
    setHint('Подборка · нажмите на карту, чтобы посмотреть');
  } else {
    showCardOfDay();
  }

  canBuzz = true;   // дальше уже настоящие вытягивания — можно жужжать

  // Подключение к серверу — только если он задан (?server= или DEFAULT_SERVER_URL).
  // Без этого приложение работает полностью автономно, как прежде.
  if (serverOn()) {
    dbg('сервер: ' + SERVER_URL + (masterSlug ? ' · мастер ' + masterSlug : ''));
    initMasterMode();
    // Порядок важен: сперва меняем код из кабинета на пропуск, потом спрашиваем
    // доступ. Гостевой пропуск запрашиваем уже зная план — платящему он не нужен.
    redeemDeckPass()
      .then(refreshAccess)
      .then(requestGuestPass)
      .then(() => (isPaid() ? null : refreshAccess()))
      .then(resumePendingPayment);
  }

  dbg('вибрация в браузере: ' + (typeof navigator.vibrate === 'function' ? 'есть' : 'НЕТ') +
      ' | узор ' + BUZZ_PATTERN.join('-') + ' (' + BUZZ_MS + 'мс)' +
      ' | датчик глушится на ' + (BUZZ_MS + BUZZ_SETTLE) + 'мс');
  dbg('звук: Web Audio ' + ((window.AudioContext || window.webkitAudioContext) ? 'есть' : 'НЕТ') +
      ' | звук ' + (muted ? 'ВЫКЛ' : 'вкл') + ' | коснитесь экрана для разблокировки');
})();
