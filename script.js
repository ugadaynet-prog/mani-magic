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

  // Фразы в колоде разной длины — от 33 до 126 символов, а размер шрифта в CSS
  // один на всех. У грани карты overflow:hidden, поэтому длинная фраза просто
  // срезалась на середине слова (видно и в приложении, и в браузере).
  // Подгоняем размер под доступную высоту: уменьшаем, пока текст не поместится.
  const PHRASE_MIN_PX = 11;
  function fitPhrase() {
    const back = phraseEl && phraseEl.parentElement;
    if (!back || !back.clientHeight) return;
    phraseEl.style.fontSize = '';                     // вернуть базовый размер из CSS
    const cs = getComputedStyle(back);
    const logo = back.querySelector('.back-logo');
    const avail = back.clientHeight
      - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      - (logo ? logo.getBoundingClientRect().height : 0)
      - (parseFloat(getComputedStyle(phraseEl).marginBottom) || 0);
    if (!(avail > 0)) return;
    let size = parseFloat(getComputedStyle(phraseEl).fontSize) || 22;
    // Шаг в 0.5px: на самой длинной фразе это десятки итераций, каждая — только
    // чтение высоты уже перерисованного элемента, заметной паузы не даёт.
    while (size > PHRASE_MIN_PX && phraseEl.scrollHeight > avail) {
      size -= 0.5;
      phraseEl.style.fontSize = size + 'px';
    }
  }
  // Поворот экрана и смена размера окна меняют доступную высоту — пересчитываем.
  window.addEventListener('resize', fitPhrase);
  const shakeBtn = document.getElementById('shakeBtn');
  const permBtn = document.getElementById('permBtn');
  const workBtn = document.getElementById('workBtn');
  const workOverlay = document.getElementById('workOverlay');
  const workImg = document.getElementById('workImg');
  const workPrev = document.getElementById('workPrev');
  const workNext = document.getElementById('workNext');
  const workCaption = document.getElementById('workCaption');
  const workDots = document.getElementById('workDots');
  const workWant = document.getElementById('workWant');

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
  const catalogTitle = document.getElementById('catalogTitle');
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

  // Отступы под системные панели в нативной сборке.
  //
  // На Android WebView css-функция env(safe-area-inset-*) про статус-бар и панель
  // навигации ничего не знает — она про вырез экрана на iOS и здесь всегда даёт
  // ноль. Поэтому класс native-insets обнуляет env(), а реальные значения мы
  // спрашиваем у нативной части через плагин Insets и подставляем сами.
  //
  // Именно спрашиваем, а не ждём: версии 7 и 8 пытались ставить padding нативно,
  // и оба раза он до WebView не доезжал — контент оставался под панелями. Здесь
  // инициатива у страницы, поэтому промахнуться по времени невозможно.
  if (isNativeApp()) {
    document.documentElement.classList.add('native-insets');

    const applyInsets = (tries) => {
      const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Insets;
      if (!plugin) return;
      plugin.get().then((r) => {
        // ready:false — окно ещё не отдало размеры панелей. Отличаем это от
        // честного «панелей нет», иначе застряли бы на нулях навсегда.
        if (!r || (!r.ready && tries > 0)) {
          setTimeout(() => applyInsets(tries - 1), 150);
          return;
        }
        const num = (v) => Math.max(0, Math.round(Number(v) || 0));
        let top = num(r.top);
        const bottom = num(r.bottom);

        // Страховка. На живом устройстве версия 1.3.1 получила верный нижний
        // отступ и НУЛЕВОЙ верхний — иконки сверху обрезало статус-баром.
        // Почему top приходит нулём, пока неясно, поэтому подстраховываемся:
        // статус-бар на Android почти всегда 24–32dp, и если сверху пришёл ноль
        // при непустом низе, значение явно неправдоподобное. Лишний зазор — это
        // косметика, а обрезанные кнопки нажать нельзя вообще.
        if (top < 8 && bottom > 0) top = 28;

        const root = document.documentElement.style;
        root.setProperty('--sat', top + 'px');
        root.setProperty('--sab', bottom + 'px');
        root.setProperty('--sal', num(r.left) + 'px');
        root.setProperty('--sar', num(r.right) + 'px');

        // Диагностику убрали: на устройстве подтвердилось, что плагин отдаёт
        // верные значения (сверху 27, снизу 48). Причина съезда была не в них,
        // а в размере карты — он считался от полной высоты экрана, см. style.css.
      }).catch(() => {});
    };

    applyInsets(20);
    // Поворот экрана и возврат из фона меняют панели местами и по высоте.
    window.addEventListener('resize', () => applyInsets(3));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) applyInsets(3);
    });
  }

  // Публичный адрес приложения. Внутри Capacitor страница живёт на
  // https://localhost, и location.origin даёт именно его — ссылка «поделиться»
  // уезжала получателю как https://localhost/?card=1 и не открывалась ни у кого.
  // Поэтому для ссылок наружу берём канонический адрес, а не текущий origin.
  const PUBLIC_APP_URL = 'https://mani-magic.ru/app/';
  const shareLink = (query) => (isNativeApp()
    ? PUBLIC_APP_URL
    : location.origin + location.pathname) + query;

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
          // именно window.history: ниже в файле объявлена своя переменная history
          // (история вытянутых карт), и без префикса код молча падал в try/catch,
          // а одноразовый код так и оставался висеть в адресной строке
          window.history.replaceState(null, '', u.toString());
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
        // Сервер сам говорит, что это хозяин колоды (пропуск kind=master), а не
        // клиент по QR. Раньше это выводилось из ?pass= в адресе — и после
        // ручного ввода кода мастер оставался без плашки и без выхода в кабинет.
        isOwnMaster = a.via === 'master';
        // Сервер знает мастера и для гостевого пропуска — так связь
        // восстанавливается даже там, где localStorage пуст (переустановили
        // приложение, почистили данные). Пока пропуск жив, клиент остаётся «своим».
        if (a.masterSlug && !masterSlug) {
          masterSlug = a.masterSlug;
          try { localStorage.setItem(MASTER_KEY, masterSlug); } catch (e) {}
          // мастер стал известен только сейчас — витрину и колоду ещё не строили
          if (!isOwnMaster) { initMasterMode(); pinMasterToManifest(); }
        }
        applyPlanUI();
        refreshMasterBar();
        updatePickBtn();   // кто перед нами, становится известно только здесь
        dbg('доступ: ' + plan + (isOwnMaster ? ' (мастер)' : ''));
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

  // --- Меню «Ещё»: установка на телефон и вход мастера по коду ---
  // Живёт отдельно от окна оплаты: мастер с уже открытой колодой окно оплаты
  // не видит, а значит не нашёл бы ни установку, ни ввод кода.
  const moreBtn = document.getElementById('moreBtn');
  const moreSheet = document.getElementById('moreSheet');
  const moreClose = document.getElementById('moreClose');
  const moreCabinet = document.getElementById('moreCabinet');
  const installBtn = document.getElementById('installBtn');
  const installHint = document.getElementById('installHint');
  const masterToggle = document.getElementById('masterToggle');
  const masterBox = document.getElementById('masterBox');
  const masterCode = document.getElementById('masterCode');
  const masterBtn = document.getElementById('masterBtn');
  const masterMsg = document.getElementById('masterMsg');
  const installedNote = document.getElementById('installedNote');
  // Признак «только что поставили» переживает перезапуск: приложение открывается
  // уже как отдельное окно, и обычным способом факт установки не узнать.
  const INSTALLED_KEY = 'maniMagicInstalled';
  let justInstalled = false;
  try { justInstalled = localStorage.getItem(INSTALLED_KEY) === '1'; } catch (e) {}

  const MASTER_CODE_ERRORS = {
    invalid_code: 'Код не найден — проверьте, нет ли опечатки',
    code_used: 'Этот код уже использован. Возьмите новый в кабинете',
    code_expired: 'Код истёк. Возьмите новый в кабинете',
    no_pro: 'Подписка Pro не активна',
    no_device: 'Не удалось определить устройство',
  };

  // Вход мастера по почте прямо в приложении. Нужен тем, кто пришёл из RuStore:
  // покупка там висит на анонимном устройстве, и без входа мастер не получает ни
  // кабинета, ни QR, ни витрины, а в базе мастеров не появляется вовсе.
  const MASTER_LOGIN_ERRORS = {
    bad_email: 'Проверьте адрес почты',
    consent_required: 'Отметьте согласие на обработку данных',
    bad_code: 'Код не подошёл. Проверьте или запросите новый',
    send_failed: 'Не удалось отправить письмо. Попробуйте позже',
    device_already_claimed: 'Эта покупка уже привязана к другому аккаунту',
  };
  const MASTER_TOKEN_KEY = 'maniMasterToken';
  const getMasterToken = () => { try { return localStorage.getItem(MASTER_TOKEN_KEY) || ''; } catch (e) { return ''; } };
  const setMasterToken = (t) => { try { localStorage.setItem(MASTER_TOKEN_KEY, t); } catch (e) {} };

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS притворяется Mac

  function openMore() {
    moreSheet.classList.remove('hidden');
    refreshMoreSheet();
  }
  function closeMore() {
    moreSheet.classList.add('hidden');
    masterBox.classList.add('hidden');
    masterMsg.classList.add('hidden');
  }
  if (moreBtn) moreBtn.addEventListener('click', openMore);
  if (moreClose) moreClose.addEventListener('click', closeMore);
  if (moreSheet) moreSheet.addEventListener('click', (e) => { if (e.target === moreSheet) closeMore(); });

  // Что показывать в меню — зависит от того, установлено ли приложение,
  // умеет ли браузер ставить его сам и открыта ли уже колода у мастера.
  function refreshMoreSheet() {
    const installed = isStandalone() || justInstalled;
    installBtn.classList.toggle('hidden', !window.__installEvent || installed);
    // подсказку про «Домой» показываем только там, где ставят руками (iPhone)
    installHint.classList.toggle('hidden', !(isIOS() && !installed));
    // а на Android — что делать, если значок не появился на главном экране
    installedNote.classList.toggle('hidden', !(justInstalled && !isIOS()));
    // «Кабинет мастера» — только своему мастеру, не клиенту по QR
    moreCabinet.classList.toggle('hidden', !isOwnMaster);
    // код уже не нужен, если колода открыта именно как у мастера
    masterToggle.classList.toggle('hidden', isOwnMaster);
  }
  window.addEventListener('mm-installable', () => {
    if (!moreSheet.classList.contains('hidden')) refreshMoreSheet();
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      const ev = window.__installEvent;
      if (!ev) return;
      ev.prompt();
      const res = await ev.userChoice.catch(() => null);
      track('app_install', { outcome: res ? res.outcome : 'unknown' });
      window.__installEvent = null;
      installBtn.classList.add('hidden');
    });
  }
  window.addEventListener('appinstalled', () => {
    window.__installEvent = null;
    justInstalled = true;
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
    installBtn.classList.add('hidden');
    installHint.classList.add('hidden');
    if (!moreSheet.classList.contains('hidden')) refreshMoreSheet();
    toast('Установлено! Значок — в списке приложений телефона');
  });

  // --- Вход мастера по почте (для пришедших из RuStore) ---
  const mLoginToggle = document.getElementById('mLoginToggle');
  const mLoginBox = document.getElementById('mLoginBox');
  const mStepEmail = document.getElementById('mStepEmail');
  const mStepCode = document.getElementById('mStepCode');
  const mStepPhone = document.getElementById('mStepPhone');
  const mEmail = document.getElementById('mEmail');
  const mConsent = document.getElementById('mConsent');
  const mCode = document.getElementById('mCode');
  const mPhone = document.getElementById('mPhone');
  const mLoginMsg = document.getElementById('mLoginMsg');

  function showLoginMsg(text) {
    if (!mLoginMsg) return;
    mLoginMsg.textContent = text;
    mLoginMsg.classList.remove('hidden');
  }
  function loginStep(step) {
    if (mLoginMsg) mLoginMsg.classList.add('hidden');
    [mStepEmail, mStepCode, mStepPhone].forEach((el) => el && el.classList.add('hidden'));
    if (step) step.classList.remove('hidden');
  }
  // Понятный текст по коду ошибки от сервера. Если код не пришёл вовсе — значит
  // запрос не дошёл до сервера, и общее «Не получилось» тут только мешает: в
  // нативной сборке 1.3.4 запросы вообще не покидали устройство (в логах nginx
  // за время попыток ни одной записи, включая CORS-предзапрос), а сообщение об
  // этом ничего не говорило. Поэтому при сетевом сбое показываем техническую
  // причину — по ней видно, TLS это, DNS или блокировка.
  const loginErr = (e) => {
    const known = MASTER_LOGIN_ERRORS[e && e.code];
    if (known) return known;
    if (e && e.status) return 'Сервер ответил ошибкой ' + e.status;
    const why = (e && (e.message || e.name)) || 'причина неизвестна';
    return 'Запрос не дошёл до сервера: ' + why;
  };

  if (mLoginToggle) {
    mLoginToggle.addEventListener('click', () => {
      mLoginBox.classList.toggle('hidden');
      if (!mLoginBox.classList.contains('hidden')) {
        loginStep(mStepEmail);
        mEmail.focus();
      }
    });
  }

  const mSendCode = document.getElementById('mSendCode');
  if (mSendCode) {
    mSendCode.addEventListener('click', () => {
      const email = (mEmail.value || '').trim();
      if (mLoginMsg) mLoginMsg.classList.add('hidden');
      if (!EMAIL_RE.test(email)) { showLoginMsg('Проверьте адрес почты'); mEmail.focus(); return; }
      // Согласие спрашиваем до отправки кода — как в кабинете: база мастеров
      // ведётся с согласием с первого дня, задним числом его не добрать.
      if (!mConsent.checked) { showLoginMsg('Отметьте согласие на обработку данных'); return; }
      if (!serverOn()) { showLoginMsg('Нет связи с сервером'); return; }
      mSendCode.disabled = true;
      api('/api/master/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(() => { loginStep(mStepCode); mCode.focus(); })
        .catch((e) => showLoginMsg(loginErr(e)))
        .finally(() => { mSendCode.disabled = false; });
    });
  }

  const mBackEmail = document.getElementById('mBackEmail');
  if (mBackEmail) mBackEmail.addEventListener('click', () => { loginStep(mStepEmail); mEmail.focus(); });

  const mVerify = document.getElementById('mVerify');
  if (mVerify) {
    mVerify.addEventListener('click', () => {
      const email = (mEmail.value || '').trim();
      const code = (mCode.value || '').trim();
      if (mLoginMsg) mLoginMsg.classList.add('hidden');
      if (!code) { showLoginMsg('Введите код из письма'); return; }
      mVerify.disabled = true;
      api('/api/master/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, code: code, consent: !!mConsent.checked }),
      })
        .then((r) => {
          setMasterToken(r.token);
          // Покупка из RuStore висит на устройстве — забираем её на аккаунт, иначе
          // купивший в магазине останется без кабинета. Нечего забирать — не беда.
          return api('/api/master/claim-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
            body: JSON.stringify({ deviceId: deviceId }),
          }).catch(() => null);
        })
        .then(() => { loginStep(mStepPhone); mPhone.focus(); })
        .catch((e) => showLoginMsg(loginErr(e)))
        .finally(() => { mVerify.disabled = false; });
    });
  }

  const mSavePhone = document.getElementById('mSavePhone');
  if (mSavePhone) {
    mSavePhone.addEventListener('click', () => {
      const phone = (mPhone.value || '').trim();
      if (mLoginMsg) mLoginMsg.classList.add('hidden');
      if (phone.replace(/\D/g, '').length < 10) { showLoginMsg('Проверьте номер телефона'); return; }
      const token = getMasterToken();
      mSavePhone.disabled = true;
      api('/api/master/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ phone: phone }),
      })
        // Если Pro уже на аккаунте (перенесли покупку или промокод) — открываем
        // колоду на этом устройстве сразу, чтобы мастер не вводил код руками.
        .then(() => api('/api/master/deck-pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: '{}',
        }).catch(() => null))
        .then((dp) => {
          if (!dp || !dp.code) return null;
          return api('/api/deck-pass/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: dp.code, deviceId: deviceId }),
          }).catch(() => null);
        })
        .then(() => refreshAccess())
        .then(() => {
          mLoginBox.classList.add('hidden');
          closeMore();
          if (isPaid()) paywallOverlay.classList.add('hidden');
          toast('Готово! Вы вошли как мастер 💅');
        })
        .catch((e) => showLoginMsg(loginErr(e)))
        .finally(() => { mSavePhone.disabled = false; });
    });
  }

  if (masterToggle) {
    masterToggle.addEventListener('click', () => {
      masterBox.classList.toggle('hidden');
      if (!masterBox.classList.contains('hidden')) masterCode.focus();
    });
  }
  if (masterBtn) {
    masterBtn.addEventListener('click', () => {
      const code = (masterCode.value || '').trim();
      masterMsg.classList.add('hidden');
      if (!code) { showMasterMsg('Введите код из кабинета'); return; }
      // Сюда часто вводят промокод из рассылки (MASTER-XXXXXX) — это другой код:
      // промокод включает Pro и активируется в кабинете, где мастер входит по почте,
      // а здесь ждём одноразовый код устройства из кнопки «Показать код для приложения».
      // Без подсказки человек упирается в «Код не подошёл» и не понимает, куда идти.
      if (/^MASTER-/i.test(code)) {
        showMasterMsg('Это промокод — активируйте его по ссылке из сообщения, в кабинете мастера. ' +
          'А сюда нужен код вида XXXX-XXXX: в кабинете кнопка «Показать код для приложения».');
        return;
      }
      if (!serverOn()) { showMasterMsg('Нет связи с сервером'); return; }
      masterBtn.disabled = true;
      api('/api/deck-pass/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, deviceId: deviceId }),
      })
        .then(() => refreshAccess())
        .then(() => {
          if (isPaid()) {
            closeMore();
            paywallOverlay.classList.add('hidden');
            toast('Готово! Колода открыта 💅');
          } else {
            showMasterMsg('Не получилось открыть колоду');
          }
        })
        .catch((e) => showMasterMsg(MASTER_CODE_ERRORS[e.code] || 'Код не подошёл'))
        .finally(() => { masterBtn.disabled = false; });
    });
  }
  function showMasterMsg(text) {
    masterMsg.textContent = text;
    masterMsg.classList.remove('hidden');
  }

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
  // Слуг ЗАПОМИНАЕМ. Установленное на телефон приложение стартует по start_url
  // из манифеста, без ?master= в адресе, — и без этого клиент терял «своего»
  // мастера сразу после установки: личный QR переставал быть личным.
  const MASTER_KEY = 'maniMasterSlug';
  let masterSlug = '';
  try {
    masterSlug = new URLSearchParams(location.search).get('master') || '';
    if (masterSlug) localStorage.setItem(MASTER_KEY, masterSlug);
    else masterSlug = localStorage.getItem(MASTER_KEY) || '';
  } catch (e) {}
  const masterMode = () => serverOn() && !!masterSlug;

  // Установка на телефон должна сохранять мастера. iOS при добавлении на экран
  // «Домой» берёт start_url ИЗ МАНИФЕСТА и параметры текущего адреса выбрасывает,
  // а хранилище у приложения на экране своё — отдельное от Safari, так что
  // запомненный слуг туда не попадёт. Поэтому подменяем манифест на лету: кладём
  // мастера прямо в start_url. Тогда приложение стартует с ?master=, и дальше всё
  // чинится само — и витрина, и новый гостевой пропуск на полную колоду.
  // Если браузер подмену не примет — останется прежнее поведение, ничего не ломается.
  function pinMasterToManifest() {
    if (!masterSlug) return;
    const link = document.querySelector('link[rel="manifest"]');
    if (!link || typeof Blob !== 'function' || !URL.createObjectURL) return;
    fetch('manifest.json')
      .then((r) => r.json())
      .then((mf) => {
        mf.start_url = './index.html?master=' + encodeURIComponent(masterSlug);
        const url = URL.createObjectURL(new Blob([JSON.stringify(mf)], { type: 'application/manifest+json' }));
        link.href = url;
        dbg('манифест: start_url с мастером ' + masterSlug);
      })
      .catch((e) => dbg('манифест: не подменён — ' + e.message));
  }

  // Хозяин колоды это или клиент по QR — определяет сервер (kind пропуска),
  // ответ приходит в /api/access. На адрес ссылки не смотрим: код из него
  // стирается сразу, а в установленное приложение его вообще вводят руками.
  let isOwnMaster = false;
  const CABINET_URL = 'https://api.mani-magic.ru/master/';
  let masterWorks = [];   // фото работ мастера — для витрины клиенту
  let masterDeck = [];    // колода мастера: [{ color, works[] }], пусто = не опубликована
  let useMasterDeck = false;   // какую колоду сейчас тянет клиентка

  // Плашка сверху. Перерисовывается при каждом ответе сервера, поэтому
  // появляется и после ручного ввода кода, и после перезагрузки.
  // Кнопки в углах должны стоять ПОД плашкой, а её высота зависит от содержимого
  // (у клиента там ещё город). Меряем и отдаём в CSS.
  function syncMasterBarHeight() {
    const bar = document.querySelector('.master-bar');
    document.documentElement.style.setProperty('--mb-h', bar ? bar.offsetHeight + 'px' : '0px');
  }

  function refreshMasterBar() {
    const own = document.querySelector('.master-bar.mb-own');
    if (isOwnMaster) {
      if (!own) {
        // витрину студии (её строит клиентский путь) при этом не трогаем
        const other = document.querySelector('.master-bar');
        if (other) other.remove();
        renderOwnMasterBar();
      }
      return;
    }
    // Плашку клиента, пришедшего по QR, оставляем как есть — убираем только свою.
    if (own) {
      own.remove();
      document.body.classList.remove('has-master-bar');
      syncMasterBarHeight();
    }
  }

  // У мастера может быть ещё не задан адрес студии — плашку клиента тогда
  // не построить, но выход в кабинет нужен в любом случае.
  function renderOwnMasterBar() {
    const bar = document.createElement('div');
    bar.className = 'master-bar mb-own';
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
    syncMasterBarHeight();
  }

  let masterInited = false;   // витрину строим один раз, кто бы сюда ни зашёл
  function initMasterMode() {
    // Свою колоду мастер видит с плашкой «В кабинет» — витрина студии ему не нужна,
    // её строим только клиенту, пришедшему по QR.
    if (!masterMode() || isOwnMaster) { refreshMasterBar(); return; }
    if (masterInited) return;
    masterInited = true;
    api('/api/m/' + encodeURIComponent(masterSlug))
      .then((r) => {
        const m = r.master || {};
        const abs = (u) => (/^https?:/.test(u) ? u : SERVER_URL + u);
        masterWorks = (Array.isArray(m.works) ? m.works : []).map(abs);
        // Колода мастера: карта = группа цвета с его работами. Приходит только
        // если мастер сам её опубликовал, иначе массив пустой и выбора не будет.
        masterDeck = (Array.isArray(m.deck) ? m.deck : [])
          .filter((c) => c && c.color && Array.isArray(c.works) && c.works.length)
          .map((c) => ({ color: c.color, works: c.works.map(abs) }));
        renderDeckSwitch();
        renderMasterBar(m);
        track('master_open', { slug: masterSlug });
      })
      .catch((e) => dbg('мастер: ' + e.message));
  }

  // Переключатель «наша колода / колода мастера». Появляется только у клиентки
  // по QR и только если мастер свою колоду опубликовал.
  function renderDeckSwitch() {
    const row = document.getElementById('deckSwitch');
    if (!row) return;
    const show = masterDeck.length > 0 && !isOwnMaster;
    row.classList.toggle('hidden', !show);
    if (!show) { useMasterDeck = false; return; }
    document.getElementById('deckOurs').classList.toggle('on', !useMasterDeck);
    document.getElementById('deckTheirs').classList.toggle('on', useMasterDeck);
  }

  function switchDeck(toMaster) {
    if (useMasterDeck === toMaster) return;
    useMasterDeck = toMaster;
    lastMasterColor = null;
    deckBag = [];            // наша стопка пересобирается при возврате
    renderDeckSwitch();
    track('deck_switch', { deck: toMaster ? 'master' : 'ours' });
    drawSource = 'deck_switch';
    drawCard();              // сразу показываем карту из выбранной колоды
  }

  function renderMasterBar(m) {
    if (!m) return;
    if (m.accent) {
      document.documentElement.style.setProperty('--master-accent', m.accent);
      document.body.classList.add('has-master-accent');   // включает акцент студии на кнопке выбора
    }
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
    // Кнопка обратно — только самому мастеру; клиенту в салоне она не нужна
    // и только путала бы. Свою колоду мастер видит без витрины студии, так что
    // сюда попадаем редко — но проверку оставляем на случай гонки ответов.
    if (isOwnMaster) {
      const back = document.createElement('a');
      back.className = 'mb-back';
      back.href = CABINET_URL;
      back.textContent = 'В кабинет';
      actions.appendChild(back);
    }
    bar.appendChild(actions);

    document.body.appendChild(bar);
    document.body.classList.add('has-master-bar');
    syncMasterBarHeight();
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

  // --- Клиент показывает мастеру свой выбор -------------------------------
  // Раньше запись уходила при КАЖДОЙ тряске, и мастер получал поток случайных
  // карт и пушей. Теперь — только осознанное нажатие, с номером понравившегося
  // дизайна и именем, если клиент захочет его назвать.
  const pickBtn = document.getElementById('pickBtn');
  const pickSheet = document.getElementById('pickSheet');
  const pickName = document.getElementById('pickName');
  const pickPreview = document.getElementById('pickPreview');
  const pickPreviewImg = document.getElementById('pickPreviewImg');
  const pickPreviewLabel = document.getElementById('pickPreviewLabel');
  const pickDesignHint = document.getElementById('pickDesignHint');
  // Какой из пяти дизайнов клиентка ВЫБРАЛА кнопкой «Хочу этот» (не «посмотрела
  // последним»). null — не выбирала: тогда мастеру уходит только номер карты.
  let pickedDesign = null;
  let pickedLabel = '';

  function updatePickBtn() {
    if (!pickBtn) return;
    // Карта сменилась — прошлый выбор дизайна к новой карте не относится.
    pickedDesign = null;
    pickedLabel = '';
    // Только клиенту, пришедшему по QR. Мастер открывает СВОЮ колоду с тем же
    // ?master=slug, поэтому одного masterMode() мало — показывать ему некому.
    pickBtn.classList.toggle('hidden', !masterMode() || isOwnMaster);
  }

  function openPickSheet() {
    // Показываем миниатюру выбранной работы, а не номер дизайна: клиентка должна
    // видеть, что уходит мастеру. Не выбрала — честно говорим, что уйдёт карта.
    const has = !!pickedDesign;
    if (pickPreview) {
      pickPreview.classList.toggle('hidden', !has);
      if (has) {
        pickPreviewImg.src = currentWorks[pickedDesign - 1] || '';
        pickPreviewLabel.textContent = pickedLabel || ('Дизайн № ' + pickedDesign);
      }
    }
    pickDesignHint.textContent = has
      ? 'Мастер увидит эту работу и карту ' + (currentIndex + 1)
      : 'Мастер увидит карту ' + (currentIndex + 1) + ' — без конкретной работы. Откройте «Примеры работ» и нажмите «Хочу этот», чтобы выбрать дизайн';
    pickSheet.classList.remove('hidden');
    pickName.focus();
  }
  function closePickSheet() { pickSheet.classList.add('hidden'); }

  function sendPick() {
    const body = { card: currentIndex + 1 };
    if (pickedDesign) {
      body.design = pickedDesign;
      // Название техники — чтобы в кабинете читалось «Фольга · мрамор», а не
      // «дизайн № 3». Названия уже есть в data.js, мастеру их и показываем.
      if (pickedLabel) body.designLabel = pickedLabel;
    }
    const nm = (pickName.value || '').trim();
    if (nm) body.name = nm;
    closePickSheet();
    toast('Мастер увидит ваш выбор 💅');
    track('client_pick', { card: currentIndex + 1, design: pickedDesign || 0, named: !!nm });
    api('/api/m/' + encodeURIComponent(masterSlug) + '/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  // --- Системная кнопка «Назад» закрывает открытое окно -------------------
  // Без этого на Android «Назад» выходила из приложения прямо из избранного,
  // каталога или фильтра. Сделано одним местом: следим за появлением окон, а не
  // дописываем обработчик в каждую из десяти функций открытия.
  // Порядок — сверху вниз по слоям: закрываем то, что лежит выше всех.
  const OVERLAYS = [
    ['pickSheet', () => closePickSheet()],
    ['mwLightbox', () => closeLightbox()],
    ['workOverlay', () => closeWork()],
    ['masterWorksOverlay', () => closeMasterWorks()],
    ['moreSheet', () => closeMore()],
    ['paywallOverlay', null], ['catalogOverlay', null], ['favOverlay', null],
    ['selOverlay', null], ['filterOverlay', null], ['qrOverlay', null],
  ];
  const isOpen = (id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  };
  const anyOpen = () => OVERLAYS.some(([id]) => isOpen(id));
  let backEntryPushed = false;   // лежит ли в истории наша запись под открытое окно
  let ignorePop = false;         // мы сами вызвали window.history.back(), закрывать нечего

  function closeTopOverlay() {
    for (const [id, closer] of OVERLAYS) {
      if (!isOpen(id)) continue;
      if (closer) closer();
      else document.getElementById(id).classList.add('hidden');
      return true;
    }
    return false;
  }

  // Появилось окно — кладём запись в историю; закрылось последнее — забираем её
  // обратно, иначе «Назад» пришлось бы жать дважды.
  // В некоторых окружениях (встроенные вебвью, строгие режимы приватности)
  // History API урезан. Тогда просто не трогаем историю: окна закрываются
  // крестиком и свайпом, как и раньше, а приложение не сыплет ошибками.
  const canHistory = typeof window.history.pushState === 'function';

  function syncHistory() {
    if (!canHistory) return;
    const open = anyOpen();
    if (open && !backEntryPushed) {
      try { window.history.pushState({ mmOverlay: true }, ''); backEntryPushed = true; } catch (e) {}
    } else if (!open && backEntryPushed) {
      backEntryPushed = false;
      ignorePop = true;
      try { window.history.back(); } catch (e) { ignorePop = false; }
    }
  }

  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    if (!anyOpen()) return;              // окон нет — это обычная навигация
    backEntryPushed = false;             // запись уже израсходована переходом назад
    closeTopOverlay();
    syncHistory();                       // осталось открытое окно — кладём запись снова
  });

  // Ловим открытие/закрытие по смене класса hidden — работает и для тех окон,
  // которые закрываются кликом по фону или свайпом, а не только кнопкой.
  const overlayWatcher = new MutationObserver(() => syncHistory());
  OVERLAYS.forEach(([id]) => {
    const el = document.getElementById(id);
    if (el) overlayWatcher.observe(el, { attributes: true, attributeFilter: ['class'] });
  });

  document.getElementById('deckOurs')?.addEventListener('click', () => switchDeck(false));
  document.getElementById('deckTheirs')?.addEventListener('click', () => switchDeck(true));

  updatePickBtn();   // состояние кнопки известно сразу, не дожидаясь первой карты

  if (pickBtn) {
    pickBtn.addEventListener('click', openPickSheet);
    document.getElementById('pickSend').addEventListener('click', sendPick);
    document.getElementById('pickCancel').addEventListener('click', closePickSheet);
    pickSheet.addEventListener('click', (e) => { if (e.target === pickSheet) closePickSheet(); });
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

  // Системное «Поделиться» в нативной сборке.
  // В WebView Capacitor нет navigator.share — Web Share API там просто не
  // реализован, поэтому код уходил в запасной путь и молча копировал ссылку
  // в буфер вместо списка мессенджеров. Плагин @capacitor/share открывает
  // настоящее системное окно выбора.
  function nativeShare(payload) {
    const share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    if (!isNativeApp() || !share) return false;
    share.share({ title: payload.title, text: payload.text, url: payload.url })
      .catch(() => {});   // отмену пользователем не считаем ошибкой
    return true;
  }

  // --- Поделиться текущей картой ---
  // Ссылка ведёт прямо на эту карту (?card=N) — получатель откроет именно её.
  function shareCard() {
    if (!hasCard) return;
    track('share_card', { card: currentIndex + 1 });
    const url = shareLink('?card=' + (currentIndex + 1));
    const payload = { title: 'MANI Magic', text: 'Хочу такой маникюр 💅', url };

    if (nativeShare(payload)) return;
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
    const url = shareLink('?cards=' + nums);
    const n = favorites.length;
    const text = 'Моя подборка: ' + n + ' ' + plural(n, 'карта', 'карты', 'карт') + ' 💅';
    const payload = { title: 'MANI Magic — подборка', text, url };

    if (nativeShare(payload)) return;
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

  // --- Каталог: карты сеткой, с учётом выбранного цвета ---
  // Ключ перестройки — план И фильтр: раньше он был только по плану, поэтому
  // после смены цвета сетка оставалась старой. Из-за этого фильтр выглядел
  // общим, а работал только на тряску: выбрал «Красные» — а в каталоге всё
  // вперемешку.
  let catalogBuilt = null;
  function renderCatalog() {
    const key = plan + '|' + (activeFilter || 'all');
    if (catalogBuilt === key) return;
    catalogGrid.innerHTML = '';

    // Фильтр отбирает карты, у которых нужный цвет ЕСТЬ в палитре из пяти
    // оттенков, — а не только те, что целиком в нём. Поэтому среди «Красных»
    // законно оказывается, например, бирюзовая карта с красным третьим тоном.
    // Без сортировки она попадала в начало сетки, и экран читался как ошибка
    // фильтра. Сортируем по силе совпадения: сначала карты, где выбранный цвет
    // стоит первым в разметке, потом — где групп меньше (значит, карта ближе к
    // чистому цвету). Разметка уже выверена в data.js, свою эвристику по hex
    // не выдумываем.
    const shown = activeFilter
      ? CARDS.map((_, i) => i)
          .filter((i) => (CARDS[i].colors || []).indexOf(activeFilter) !== -1)
          .sort((a, b) => {
            const A = CARDS[a].colors || [], B = CARDS[b].colors || [];
            return A.indexOf(activeFilter) - B.indexOf(activeFilter) || A.length - B.length || a - b;
          })
      : CARDS.map((_, i) => i);

    shown.forEach((idx) => {
      const card = CARDS[idx];
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

    // Заголовок называет то, что видно сейчас, иначе «Все карты» над десятью
    // красными читается как ошибка.
    catalogTitle.textContent = activeFilter || 'Все карты';

    // Счётчик тоже считаем внутри выбранного цвета: «открыто 15 из 49» над
    // одиннадцатью красными было бы неправдой.
    const freeShown = shown.filter(isFree).length;
    lockBanner.classList.toggle('hidden', isPaid());
    lockBannerText.textContent = 'Открыто ' + freeShown + ' из ' + shown.length + ' карт';
    catalogBuilt = key;
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

  // Тасуем колоду, а не бросаем кубик каждый раз. При случайном выборе с
  // возвратом повтор из 49 карт выпадает уже в первом десятке примерно в
  // половине случаев — и это читается как «показывает одно и то же».
  // Здесь карта не вернётся, пока не выйдет вся колода (или весь фильтр).
  let deckBag = [];        // оставшиеся в текущем «проходе» индексы
  let deckBagKey = '';     // под какой набор карт собрана стопка

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // В колоде мастера карта — это группа цвета. Лицо карты и фразу берём из нашей
  // колоды (у мастера их нет), а работы под ней подставляются его собственные.
  let lastMasterColor = null;
  function pickMasterIndex() {
    const colors = masterDeck.map((c) => c.color);
    if (!colors.length) return null;
    // не повторяем цвет подряд, если их больше одного
    let color;
    do { color = colors[Math.floor(Math.random() * colors.length)]; }
    while (colors.length > 1 && color === lastMasterColor);
    lastMasterColor = color;
    const ours = CARDS.map((c, i) => ((c.colors || []).includes(color) ? i : -1)).filter((i) => i >= 0);
    if (!ours.length) return null;
    return ours[Math.floor(Math.random() * ours.length)];
  }

  function pickNewIndex() {
    if (useMasterDeck) {
      const i = pickMasterIndex();
      if (i !== null) return i;
    }
    const pool = filteredPool();
    if (pool.length === 1) return pool[0];

    // сменился фильтр или подписка — стопку пересобираем
    const key = pool.join(',');
    if (key !== deckBagKey) { deckBagKey = key; deckBag = []; }

    if (!deckBag.length) {
      deckBag = shuffle(pool.slice());
      // чтобы на стыке проходов не выпала та же карта, что сейчас на экране
      if (deckBag.length > 1 && deckBag[deckBag.length - 1] === currentIndex) {
        deckBag[deckBag.length - 1] = deckBag[0];
        deckBag[0] = currentIndex;
      }
    }
    return deckBag.pop();
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
    }
    // Мастеру НЕ сообщаем про каждую тряску: это был бы поток мусора и пушей.
    // Запись уходит только когда клиент сам нажмёт «Показать мастеру».
    updatePickBtn();
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
    fitPhrase();

    // Кнопка «Примеры работ» — только если у карты есть фото работ.
    // В колоде мастера под картой лежат ЕГО работы этого цвета, а не наши.
    // Цвет берём от самой выпавшей карты, а не из переменной, оставшейся от
    // прошлого вызова: карту можно открыть и из каталога, избранного или истории —
    // там выбор цвета не выполняется, и подстановка молча срывалась.
    const own = useMasterDeck
      ? masterDeck.find((c) => c.color === lastMasterColor && (data.colors || []).includes(c.color))
        || masterDeck.find((c) => (data.colors || []).includes(c.color))
      : null;
    currentWorks = own ? own.works.slice()
      : (Array.isArray(data.works) ? data.works.slice() : []);
    currentLabels = own ? own.works.map(() => 'Работа мастера')
      : (Array.isArray(data.workLabels) ? data.workLabels : []);
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
      // В колоде мастера работы под картой — его собственные, серверными их
      // подменять нельзя: иначе на платных картах снова показывались бы наши.
      if (media.works.length && !useMasterDeck) currentWorks = media.works;
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
  const workMeta = document.querySelector('.work-meta');
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
    // Кнопка «Хочу этот» показывает состояние ИМЕННО этого фото: выбрано или нет.
    // Раньше здесь стояло likedDesign = i + 1 — то есть выбором считалось просто
    // последнее просмотренное фото. Клиентка листала пять работ, останавливалась
    // на случайной, и мастеру уходила она, а не та, что понравилась.
    if (workWant) {
      const chosen = pickedDesign === i + 1;
      workWant.classList.remove('hidden');
      workWant.classList.toggle('chosen', chosen);
      workWant.textContent = chosen ? 'Выбрано ✓' : 'Хочу этот';
    }
    Array.prototype.forEach.call(workDots.children, (d, di) => {
      d.classList.toggle('active', di === workPos);
    });
  }

  // «Хочу этот» — единственное место, где дизайн становится выбранным.
  // Повторное нажатие снимает выбор: клиентка может передумать, не выходя.
  if (workWant) {
    workWant.addEventListener('click', (e) => {
      e.stopPropagation();
      const n = workPos + 1;
      if (pickedDesign === n) {
        pickedDesign = null;
        pickedLabel = '';
        workWant.classList.remove('chosen');
        workWant.textContent = 'Хочу этот';
        return;
      }
      pickedDesign = n;
      pickedLabel = currentLabels[workPos] || '';
      workWant.classList.add('chosen');
      workWant.textContent = 'Выбрано ✓';
      toast(masterMode() && !isOwnMaster
        ? 'Выбрано. Нажмите «Показать мастеру»'
        : 'Выбрано');
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
    setDrag(0);   // сбрасываем сдвиг от свайпа, иначе он останется на следующем открытии
  }
  function nextWork() { showWork(Math.min(workPos + 1, currentWorks.length - 1)); }
  function prevWork() { showWork(Math.max(workPos - 1, 0)); }

  workBtn.addEventListener('click', openWork);
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

  // Свайпы — только когда фото не увеличено.
  // Вбок листает работы, вниз закрывает галерею (кнопки-крестика больше нет).
  const CLOSE_DIST = 90;      // насколько увести палец вниз, чтобы закрыть
  let touchX = null, touchY = null, dragY = 0;

  function setDrag(y) {
    dragY = y;
    // тянем само фото и подписи, фон гасим — видно, что галерея «уезжает»
    const t = y ? 'translateY(' + y + 'px)' : '';
    workStage.style.transform = t;
    workMeta.style.transform = t;
    workOverlay.style.backgroundColor = y
      ? 'rgba(0,0,0,' + Math.max(0.35, 0.9 - y / 400) + ')'
      : '';
  }
  function endDrag(close) {
    workStage.style.transition = workMeta.style.transition = 'transform .2s ease';
    setDrag(0);
    setTimeout(() => { workStage.style.transition = workMeta.style.transition = ''; }, 220);
    if (close) closeWork();
  }

  workOverlay.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && !isZoomed()) {
      touchX = e.changedTouches[0].clientX;
      touchY = e.changedTouches[0].clientY;
    } else {
      touchX = touchY = null;
    }
  }, { passive: true });

  workOverlay.addEventListener('touchmove', (e) => {
    if (touchY === null || isZoomed() || isPinching) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    // тянем только если жест явно вертикальный и вниз — иначе это листание
    if (dy > 0 && dy > Math.abs(dx)) setDrag(dy);
  }, { passive: true });

  workOverlay.addEventListener('touchend', (e) => {
    if (touchX === null || isZoomed() || isPinching) { touchX = touchY = null; setDrag(0); return; }
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (dy > Math.abs(dx) && dy > CLOSE_DIST) endDrag(true);
    else if (Math.abs(dx) > 40 && Math.abs(dx) > dy) { endDrag(false); if (dx < 0) nextWork(); else prevWork(); }
    else endDrag(false);
    touchX = touchY = null;
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
    pinMasterToManifest();   // до того, как клиент нажмёт «на экран Домой»
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
