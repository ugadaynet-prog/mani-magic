// Кабинет мастера MANI Magic.
//
// Раздаётся с ДВУХ адресов: api.mani-magic.ru/master/ (исторический, там же
// живёт API) и mani-magic.ru/master/ (основной домен). Второй появился потому,
// что Instagram прогоняет ссылки из директа через собственный перенаправитель
// l.instagram.com, и у части мастеров он не отвечает — адрес приходится
// набирать руками, а «api.» в начале люди набирают с ошибкой.
//
// Поэтому все запросы идут по АБСОЛЮТНОМУ адресу API, а не по относительным
// путям: с основного домена относительный /api/... ушёл бы в никуда. CORS на
// сервере открыт (Access-Control-Allow-Origin: *, Authorization разрешён),
// так что кросс-доменные запросы проходят без дополнительной настройки.
(function () {
  const $ = (id) => document.getElementById(id);
  const API = 'https://api.mani-magic.ru';
  // Приводит серверный путь к абсолютному адресу. Пути вида /uploads/… приходят
  // от API относительными, и на основном домене без этого превратились бы в 404.
  const abs = (u) => (typeof u === 'string' && u.startsWith('/')) ? API + u : u;
  const TOKEN_KEY = 'maniMasterToken';
  const native = !!window.Capacitor?.isNativePlatform?.();
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let email = '';

  const authHeaders = (extra) =>
    Object.assign({}, extra || {}, token ? { Authorization: 'Bearer ' + token } : {});
  const api = (path, opts) => {
    opts = opts || {};
    opts.headers = authHeaders(opts.headers);
    return fetch(abs(path), opts).catch(() => {
      toast('Нет связи с сервером. Проверьте интернет и повторите действие.');
      return new Response(JSON.stringify({ error: 'network_unavailable' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    });
  };
  const apiJson = (path, opts) =>
    api(path, opts).then((r) =>
      r.json().then((j) => ({ status: r.status, ok: r.ok, body: j }))
       .catch(() => ({ status: r.status, ok: r.ok, body: {} })));

  let toastT;
  function toast(m) {
    const t = $('toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const show = (view) => {
    $('loginView').classList.toggle('hidden', view !== 'login');
    $('dashView').classList.toggle('hidden', view !== 'dash');
  };

  // --- Вход по коду ---
  $('consent').addEventListener('change', () => {
    $('reqBtn').disabled = !$('consent').checked;
  });
  $('reqBtn').addEventListener('click', async () => {
    email = $('email').value.trim();
    if (!email) { $('loginErr').textContent = 'Введите email'; return; }
    $('loginErr').textContent = ''; $('reqBtn').disabled = true;
    const r = await apiJson('/api/master/auth/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    $('reqBtn').disabled = !$('consent').checked;
    if (!r.ok) { $('loginErr').textContent = 'Не удалось отправить код'; return; }
    $('step1').classList.add('hidden'); $('step2').classList.remove('hidden');
    if (r.body.devCode) { $('devCode').textContent = 'Тестовый режим: код ' + r.body.devCode; $('code').value = r.body.devCode; }
    else { $('devCode').textContent = 'Код отправлен на почту'; }
    $('code').focus();
  });
  $('backBtn').addEventListener('click', () => {
    $('step2').classList.add('hidden'); $('step1').classList.remove('hidden'); $('loginErr').textContent = '';
  });
  $('verBtn').addEventListener('click', async () => {
    const code = $('code').value.trim();
    if (!code) return;
    $('loginErr').textContent = ''; $('verBtn').disabled = true;
    const r = await apiJson('/api/master/auth/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, consent: $('consent').checked }),
    });
    $('verBtn').disabled = false;
    if (r.body.error === 'consent_required') { $('loginErr').textContent = 'Отметьте согласие на предыдущем шаге'; return; }
    if (!r.ok || !r.body.token) { $('loginErr').textContent = 'Неверный код'; return; }
    token = r.body.token; localStorage.setItem(TOKEN_KEY, token);
    enterDash();
  });
  $('logoutBtn').addEventListener('click', () => {
    token = ''; localStorage.removeItem(TOKEN_KEY); location.reload();
  });

  // --- Вкладки ---------------------------------------------------------
  // Витрина работ и список выборов растут без предела, и в одной ленте всё,
  // что ниже них, становится недостижимо: чтобы дойти до расхода по цветам,
  // приходилось мотать через три сотни фотографий.
  const TAB_KEY = 'maniCabinetTab';
  let currentTab = 'main';
  // Системная «Назад» с вкладки возвращает на «Главное», и только оттуда — из
  // кабинета. Под другой вкладкой лежит ровно одна запись истории: между
  // «Работами» и «Клиентами» она подменяется, а не копится, иначе «Назад»
  // пришлось бы жать за каждое переключение. Обработчик — в конце файла.
  let tabPushed = false, tabOwnBack = false;
  function goTab(name) {
    if (name === currentTab) return;
    if (name === 'main') {
      if (tabPushed) { tabPushed = false; tabOwnBack = true; history.back(); }
      showTab('main');
      return;
    }
    try {
      if (tabPushed) history.replaceState({ cabinetTab: name }, '');
      else { history.pushState({ cabinetTab: name }, ''); tabPushed = true; }
    } catch (e) {}
    showTab(name);
  }
  function showTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach((b) =>
      b.classList.toggle('tab-on', b.dataset.tab === name));
    document.querySelectorAll('.tab-pane').forEach((p) =>
      p.classList.toggle('hidden', p.dataset.pane !== name));
    try { localStorage.setItem(TAB_KEY, name); } catch (e) {}
    // Возвращаем к началу: иначе, уйдя вниз по длинной витрине и переключив
    // вкладку, мастер попадает в пустоту под коротким содержимым.
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => goTab(b.dataset.tab)));
  {
    let saved = '';
    try { saved = localStorage.getItem(TAB_KEY) || ''; } catch (e) {}
    // Без входа кабинета не видно — запись истории под вкладкой была бы пустым нажатием «Назад».
    if (saved && document.querySelector('.tab-pane[data-pane="' + saved + '"]')) (token ? goTab : showTab)(saved);
  }

  // Пришли из калькулятора (?trial=1) — ещё до входа говорим, ради чего входить.
  if (new URLSearchParams(location.search).get('trial') === '1') $('trialHint').classList.remove('hidden');

  // Подвести к разделу Pro: со ссылки из письма (?renew=1) или калькулятора
  // (?trial=1) и из «Клиентов», когда упёрлись в лимит карточек.
  function showProCard() {
    goTab('main');
    const card = $('proCard');
    card.classList.add('attn');
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => card.classList.remove('attn'), 2600);
  }

  // --- Кабинет ---
  async function enterDash() {
    show('dash');
    const deviceId = native && localStorage.getItem('maniMagicDevice');
    if (deviceId) await apiJson('/api/master/claim-device', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }),
    });
    if (!await loadProfile()) return; // не запускаем запросы с истёкшей сессией
    loadQR(); loadWorks(); loadPicks(); loadStats(); loadClients();
    loadStatus().then(() => {
      const q = new URLSearchParams(location.search);
      if (q.get('trial') === '1' || q.get('renew') === '1') showProCard();
    });
    initPush(); startLivePicks();
  }

  async function loadProfile() {
    const r = await apiJson('/api/master/me');
    if (r.status === 401) { token = ''; localStorage.removeItem(TOKEN_KEY); show('login'); return false; }
    if (!r.ok) { show('login'); $('loginErr').textContent = 'Не удалось загрузить кабинет. Проверьте интернет и откройте кабинет ещё раз.'; return false; }
    const p = r.body.profile || {}, c = p.contacts || {};
    $('studioName').value = p.studioName || '';
    $('city').value = p.city || '';
    $('accent').value = p.accent || '';
    $('whatsapp').value = c.whatsapp || '';
    $('telegram').value = c.telegram || '';
    $('max').value = c.max || '';
    $('instagram').value = c.instagram ? '@' + c.instagram : '';
    $('bookingUrl').value = p.bookingUrl || '';
    $('proPhone').value = r.body.phone || '';
    renderAccent();
    return true;
  }

  // --- Профиль: цвет студии ----------------------------------------------
  // У клиентки этим цветом окрашены полоса студии, вкладка её колоды и кнопки
  // «Показать мастеру» и «Отправить» (--master-accent в app/style.css). Надписи
  // на них белые, поэтому в палитре только цвета, на которых они читаются.
  const ACCENT_DEFAULT = '#b5203a';   // запасной цвет полосы студии в приложении
  // Одиннадцать готовых и «свой» — ровно два ряда по шесть на телефоне.
  const ACCENTS = [
    ['', 'Как в MANI Magic'], ['#d6336c', 'Малиновый'], ['#8e24aa', 'Фиолетовый'],
    ['#4527a0', 'Индиго'], ['#1565c0', 'Синий'], ['#00838f', 'Бирюзовый'],
    ['#2e7d32', 'Зелёный'], ['#6d4c41', 'Шоколадный'], ['#bf360c', 'Терракотовый'],
    ['#37474f', 'Графитовый'], ['#1b1b1f', 'Чёрный'],
  ];
  // Контраст с белым по WCAG: ниже 3 белые надписи на кнопке читаются плохо.
  function contrastWithWhite(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 21;
    const lin = (i) => {
      const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 1.05 / (0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4) + 0.05);
  }
  function renderAccentPreview() {
    const value = ($('accent').value || '').trim();
    const color = value || ACCENT_DEFAULT;
    document.querySelector('.accent-preview').style.setProperty('--acc', color);
    $('accentBarName').textContent = $('studioName').value.trim() || 'Ваша студия';
    const preset = ACCENTS.find(([hex]) => hex === value.toLowerCase());
    $('accentName').textContent = 'Выбрано: ' + (preset ? preset[1] : 'свой цвет');
    $('accentLight').classList.toggle('hidden', contrastWithWhite(color) >= 3);
  }
  function renderAccent() {
    const value = ($('accent').value || '').trim().toLowerCase();
    const preset = ACCENTS.find(([hex]) => hex === value);
    const box = $('accentSwatches');
    box.innerHTML = '';
    ACCENTS.forEach(([hex, name]) => {
      const b = document.createElement('button');
      const on = !!preset && preset[0] === hex;
      b.type = 'button';
      b.className = 'swatch' + (on ? ' on' : '');
      b.style.background = hex || ACCENT_DEFAULT;
      b.title = name;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-label', name);
      b.addEventListener('click', () => { $('accent').value = hex; renderAccent(); });
      box.appendChild(b);
    });
    // Свой цвет — системная палитра. Пока она открыта, кружки не перерисовываем:
    // вместе с ними пропал бы и сам выбор цвета.
    const custom = document.createElement('label');
    custom.className = 'swatch swatch-custom' + (preset ? '' : ' on');
    custom.title = 'Свой цвет';
    if (!preset) custom.style.background = value;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = /^#[0-9a-f]{6}$/.test(value) ? value : ACCENT_DEFAULT;
    picker.setAttribute('aria-label', 'Свой цвет');
    picker.addEventListener('input', () => {
      $('accent').value = picker.value;
      custom.style.background = picker.value;
      renderAccentPreview();
    });
    picker.addEventListener('change', () => { $('accent').value = picker.value; renderAccent(); });
    custom.appendChild(picker);
    box.appendChild(custom);
    renderAccentPreview();
  }
  $('studioName').addEventListener('input', renderAccentPreview);

  // Instagram мастера пишут тремя способами: @anna, anna и ссылкой целиком.
  // Храним всегда голый ник — иначе по базе не собрать ни ссылку, ни список.
  function normIg(v) {
    return String(v || '').trim()
      .replace(/^https?:\/\//i, '').replace(/^www\./i, '')
      .replace(/^instagram\.com\//i, '').replace(/^@/, '')
      .replace(/[/?#].*$/, '').trim();
  }

  $('saveBtn').addEventListener('click', async () => {
    $('profErr').textContent = ''; $('saveBtn').disabled = true;
    // Окончание ссылки (slug) не отправляем: поля для него в профиле больше нет,
    // и сервер без него оставляет прежнее — QR-коды мастеров продолжают работать.
    const body = {
      studioName: $('studioName').value.trim(),
      city: $('city').value.trim(),
      accent: $('accent').value.trim(),
      contacts: {
        whatsapp: $('whatsapp').value.trim(),
        telegram: $('telegram').value.trim(),
        max: $('max').value.trim(),
        instagram: normIg($('instagram').value),
      },
      bookingUrl: $('bookingUrl').value.trim(),
    };
    const r = await apiJson('/api/master/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    $('saveBtn').disabled = false;
    if (!r.ok) { $('profErr').textContent = 'Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.'; return; }
    // показываем ник в том виде, в каком он лёг в базу, а не как его набрали
    $('instagram').value = body.contacts.instagram ? '@' + body.contacts.instagram : '';
    toast('Профиль сохранён');
  });

  // --- QR и ссылка ---
  async function loadQR() {
    const l = await apiJson('/api/master/link');
    $('qrLink').value = (l.ok && l.body.url) ? l.body.url : '';
    const r = await api('/api/master/qr.svg');
    $('qrBox').innerHTML = r.ok ? await r.text() : '';
  }
  $('copyBtn').addEventListener('click', () => {
    const v = $('qrLink').value; if (!v) return;
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => toast('Ссылка скопирована')).catch(() => {});
  });

  // --- Pro ---
  // ?promo=КОД в ссылке кабинета — подставляем в поле сами, чтобы в рассылке
  // мастерам можно было прислать одну ссылку вместо «ссылка + код отдельно».
  const promoFromLink = new URLSearchParams(location.search).get('promo') || '';

  // Что даёт Pro — одной строкой, словами мастера. Стоит там, где решают, платить
  // ли: раньше рядом с кнопкой было только «Оформите Pro», без цены и без пользы.
  const PRO_GIVES = 'С Pro клиентке по вашему QR открыты все 49 карт с примерами работ, '
    + 'клиентки видят вашу колоду из ваших работ, а карточки клиенток — без ограничения.';
  const DAY_MS = 86400000;
  const daysWord = (n) => {
    const a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return 'дней';
    if (b === 1) return 'день';
    return b > 1 && b < 5 ? 'дня' : 'дней';
  };

  async function loadStatus() {
    const r = await apiJson('/api/master/status');
    const s = r.body || {};
    const pill = $('proPill'), text = $('proText'), btn = $('proBtn'), monthBtn = $('proMonthBtn');
    const trialBtn = $('trialBtn'), price = $('proPrice'), phoneBox = $('proPhoneBox'), promoBox = $('promoBox');
    if (s.isPro) {
      const left = Math.max(0, Math.ceil((s.expiresAt - Date.now()) / DAY_MS));
      // Продлить предлагаем, когда это уместно: на пробном — всегда, иначе — за
      // неделю до конца. Досрочная оплата дни не сжигает: сервер прибавляет срок.
      const renew = !!s.trial || left <= 7;
      pill.className = 'pill on'; pill.textContent = s.trial ? 'пробный' : 'активна';
      text.textContent = (s.trial ? 'Пробный месяц до ' : 'Действует до ')
        + new Date(s.expiresAt).toLocaleDateString('ru-RU')
        + (left <= 7 ? ' — осталось ' + left + ' ' + daysWord(left) + '.' : '.')
        + (renew ? ' Продлить можно заранее — оставшиеся дни сохранятся.' : '');
      btn.textContent = 'Продлить на год — 2 490 ₽';
      btn.classList.toggle('hidden', !renew); btn.classList.remove('btn-ghost');
      monthBtn.classList.toggle('hidden', !renew);
      trialBtn.classList.add('hidden'); price.classList.add('hidden'); promoBox.classList.add('hidden');
      phoneBox.classList.toggle('hidden', !(renew && !$('proPhone').value.trim()));
      // колода открывается только по активному Pro — без него сервер откажет
      $('deckBox').classList.remove('hidden');
      $('deckBoxOwn').classList.remove('hidden');
      $('deckPublish').checked = !!s.deckPublished;
      $('catalogOptIn').checked = !!s.catalogOptIn;
    } else {
      $('deckBoxOwn').classList.add('hidden');
      pill.className = 'pill off'; pill.textContent = 'не активна';
      text.textContent = PRO_GIVES;
      // Пока пробный месяц доступен, он — главная кнопка, а оплата стоит второй.
      trialBtn.classList.toggle('hidden', !s.trialAvailable);
      price.textContent = (s.trialAvailable ? 'Потом — ' : '') + '399 ₽ в месяц или 2 490 ₽ в год. '
        + 'Автосписаний нет: срок закончился — Pro просто выключается.';
      price.classList.remove('hidden');
      btn.textContent = 'Оформить Pro на год — 2 490 ₽';
      btn.classList.remove('hidden'); btn.classList.toggle('btn-ghost', !!s.trialAvailable);
      monthBtn.classList.remove('hidden');
      phoneBox.classList.remove('hidden'); promoBox.classList.remove('hidden');
      $('deckBox').classList.add('hidden');
      if (promoFromLink && !$('promoCode').value) $('promoCode').value = promoFromLink;
    }
  }

  // --- Колода мастера ---
  // Кабинет и приложение на разных адресах, сессию мастера туда не передать:
  // берём одноразовый код на 5 минут и уходим по ссылке с ним.
  // Кабинет открыт изнутри установленного приложения? Тогда он живёт в том же
  // окне, что и колода, и «открыть колоду» означает «вернуться назад», а не
  // «загрузить веб-версию»: иначе мастер из нативного приложения окажется в
  // его же браузерной копии, без покупок RuStore и с чужим хранилищем.
  const inApp = native || new URLSearchParams(location.search).get('app') === '1';
  if (inApp) {
    const back = $('backToDeck');
    if (back) {
      back.classList.remove('hidden');
      back.addEventListener('click', () => {
        location.replace(native ? new URL('../index.html', location.href).href : 'https://localhost/index.html');
      });
    }
  }

  // Куда возвращаться внутри приложения. Кабинет открыт из него же, поэтому
  // адрес приложения лежит в referrer — из него берём только источник.
  // Не нашёлся (политика referrer) — уходим назад по истории: там колода.
  function appOrigin() {
    try {
      const u = new URL(document.referrer);
      return /^https?:$/.test(u.protocol) ? u.origin : '';
    } catch (e) { return ''; }
  }

  // Обе кнопки ведут в одно приложение, разница — какая колода откроется.
  // Снаружи нужен одноразовый пропуск (сессия кабинета в приложение не
  // передаётся), внутри приложения колода уже открыта в предыдущем шаге.
  async function openDeck(mine) {
    $('deckErr').textContent = '';
    const btn = mine ? $('myDeckBtn') : $('deckBtn');
    btn.disabled = true;
    const r = await apiJson('/api/master/deck-pass', { method: 'POST' });
    btn.disabled = false;
    if (r.body && r.body.error === 'no_pro') { $('deckErr').textContent = 'Нужна активная подписка Pro'; return; }
    if (!r.ok || !r.body.url) { $('deckErr').textContent = 'Не удалось открыть колоду'; return; }
    const u = inApp ? new URL(native ? '../index.html' : 'https://localhost/index.html', location.href) : new URL(r.body.url, location.href);
    if (inApp) {
      const pass = r.body.code || new URL(r.body.url, location.href).searchParams.get('pass');
      if (!pass) { $('deckErr').textContent = 'Не удалось получить пропуск. Попробуйте ещё раз.'; return; }
      u.searchParams.set('pass', pass);
    }
    if (mine) u.searchParams.set('deck', 'my');
    if (inApp) location.replace(u.toString());
    else location.href = u.toString();
  }

  $('deckBtn').addEventListener('click', () => openDeck(false));
  $('myDeckBtn').addEventListener('click', () => openDeck(true));

  // Код для УЖЕ установленного приложения. Нужен потому, что на iPhone у
  // приложения с экрана «Домой» своё хранилище, отдельное от Safari: пропуск,
  // полученный по ссылке в браузере, туда не попадает.
  $('codeBtn').addEventListener('click', async () => {
    $('deckErr').textContent = '';
    $('codeBtn').disabled = true;
    const r = await apiJson('/api/master/deck-pass', { method: 'POST' });
    $('codeBtn').disabled = false;
    if (!r.ok || !r.body.code) { $('deckErr').textContent = 'Не удалось получить код'; return; }
    $('codeVal').textContent = r.body.code;
    $('codeBox').classList.remove('hidden');
    $('codeBtn').textContent = 'Показать новый код';
  });
  // Оплата Pro на год или на месяц — она же продление: сервер прибавляет новый
  // срок к оставшемуся, дни не сгорают.
  async function buyPro(planKey, button) {
    const phone = $('proPhone').value.trim();
    $('proErr').textContent = '';
    if (!phone) {
      $('proPhoneBox').classList.remove('hidden');
      $('proErr').textContent = 'Укажите телефон для связи'; $('proPhone').focus(); return;
    }
    button.disabled = true;
    // сохраняем телефон вместе с профилем — до оплаты, чтобы он остался, даже если чекаут прервётся
    const saved = await api('/api/master/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }),
    });
    if (!saved.ok) { $('proErr').textContent = 'Не удалось сохранить телефон. Повторите попытку.'; button.disabled = false; return; }
    if (native) { location.replace(new URL('../index.html?buy=pro', location.href).href); return; }
    const r = await apiJson('/api/master/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planKey }),
    });
    if (r.body.error === 'phone_required') { $('proErr').textContent = 'Укажите телефон для связи'; button.disabled = false; return; }
    if (r.body.mock && r.body.paymentId) {
      await api('/api/dev/complete-mock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: r.body.paymentId }),
      });
      await loadStatus(); toast('Pro активирована (тест)');
    } else if (r.body.confirmationUrl) {
      location.href = r.body.confirmationUrl;
    } else {
      $('proErr').textContent = 'Не получилось открыть оплату. Повторите попытку.';
    }
    button.disabled = false;
  }
  $('proBtn').addEventListener('click', () => buyPro('pro_year', $('proBtn')));
  $('proMonthBtn').addEventListener('click', () => buyPro('pro_month', $('proMonthBtn')));

  // Пробный месяц: одна кнопка, без карты. Телефон — как на оплате и промокоде.
  $('trialBtn').addEventListener('click', async () => {
    const phone = $('proPhone').value.trim();
    $('proErr').textContent = '';
    if (!phone) { $('proErr').textContent = 'Укажите телефон для связи'; $('proPhone').focus(); return; }
    $('trialBtn').disabled = true;
    const saved = await api('/api/master/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }),
    });
    if (!saved.ok) { $('proErr').textContent = 'Не удалось сохранить телефон. Повторите попытку.'; $('trialBtn').disabled = false; return; }
    const r = await apiJson('/api/master/trial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    $('trialBtn').disabled = false;
    if (!r.body.ok) {
      $('proErr').textContent = {
        trial_unavailable: 'Пробный месяц на этом аккаунте уже был',
        phone_required: 'Укажите телефон для связи',
      }[r.body.error] || 'Не получилось включить пробный месяц. Повторите попытку.';
      await loadStatus();
      return;
    }
    await loadStatus();
    loadClients();
    toast('Pro включён на 30 дней 💅');
  });
  $('promoBtn').addEventListener('click', async () => {
    const code = $('promoCode').value.trim();
    const phone = $('proPhone').value.trim();
    $('promoErr').textContent = '';
    if (!code) { $('promoCode').focus(); return; }
    // Тот же телефон, что и на платном оформлении (одно поле на секцию Pro) —
    // бартерным мастерам он нужен для базы не меньше, чем платящим.
    if (!phone) { $('promoErr').textContent = 'Укажите телефон для связи выше'; $('proPhone').focus(); return; }
    $('promoBtn').disabled = true;
    await api('/api/master/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }),
    });
    const r = await apiJson('/api/master/redeem-promo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    if (r.body.ok) {
      $('promoCode').value = '';
      await loadStatus();
      toast('Pro активирована по промокоду');
    } else {
      const messages = {
        invalid_code: 'Такого кода нет или он выключен',
        code_exhausted: 'Код уже исчерпан',
        already_redeemed: 'Этот код уже был активирован на вашем аккаунте',
        phone_required: 'Укажите телефон для связи выше',
      };
      $('promoErr').textContent = messages[r.body.error] || 'Не получилось активировать код';
    }
    $('promoBtn').disabled = false;
  });

  // --- Работы ---
  // Загрузка НЕ требует выбирать цвет заранее. Раньше требовала: кнопка не
  // открывала диалог, пока цвет не выбран, потому что задать его иначе было
  // негде. Из-за этого нельзя было залить смешанную пачку одним заходом —
  // мастер должен был сам разложить фото по цветам ещё в галерее телефона и
  // грузить их по группам. Теперь цвет проставляется после, в разборе, и
  // ворота остались бы чистой помехой.
  $('addWorkBtn').addEventListener('click', () => {
    $('workErr').textContent = '';
    $('fileInput').click();
  });
  // Сжимаем прямо в браузере, до отправки. Телефон снимает по 3–5 МБ, а для
  // витрины хватает ~1400px по длинной стороне — это ~100–150 КБ. Экономит и
  // место на сервере, и мобильный трафик мастера, и время загрузки у клиента.
  const MAX_SIDE = 1400;
  function compress(file) {
    return new Promise((resolve) => {
      // не картинка или совсем маленькая — отдаём как есть, пусть решает сервер
      if (!/^image\//.test(file.type)) return resolve({ blob: file, type: file.type });
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob((blob) => {
          // если сжатие вдруг не помогло — отправляем оригинал
          resolve(blob && blob.size < file.size ? { blob, type: 'image/webp' } : { blob: file, type: file.type });
        }, 'image/webp', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob: file, type: file.type }); };
      img.src = url;
    });
  }

  // Те же группы, что в фильтре приложения и в COLORS на сервере
  const COLORS = ['Жёлтые', 'Зелёные и бирюзовые', 'Красные', 'Нюд и бежевые', 'Оранжевые',
    'Розовые', 'Светлые', 'Синие', 'Тёмные', 'Фиолетовые'];
  // Короткие подписи только для списка на плитке. В списке загрузки, где места
  // хватает, остаются полные названия — они совпадают с фильтром в приложении.
  const SHORT = { 'Зелёные и бирюзовые': 'Зелёные', 'Нюд и бежевые': 'Нюд' };
  const MAX_WORKS = 250;

  // --- Распознавание цвета работы -----------------------------------------
  //
  // Зачем: колода собирается по цветам, а проставить цвет каждой работе руками
  // — та самая работа, из-за которой из двадцати трёх активировавших мастеров
  // колоду заполнили четверо. Здесь мы не решаем за мастера, а предлагаем:
  // подсказка сверху, последнее слово за ним.
  //
  // Пороги подобраны на 245 работах колоды и проверены на независимой выборке
  // Pinterest. По цветным работам верный цвет попадает в тройку в 84% случаев.
  // Белый и чёрный лак не распознаются в принципе: ахроматичный пиксель
  // неотличим от фона, и без понимания, ГДЕ на фото ногти, эта задача не
  // решается. Поэтому там мы молчим, а не гадаем — неверная подсказка хуже
  // отсутствующей: мастер её не заметит, и колода испортится молча.
  const CT = {
    lightL: 0.86, lightS: 0.35, darkL: 0.14, grayS: 0.08,
    red2: 14, orange: 30, yellow: 58, green: 196, blue: 254, violet: 292, pink2: 344,
    skinLo: 0, skinHi: 50, skinPct: 0.80, skinMargin: 0.10, skinMinShare: 0.15,
    bgSat: 0.12, satPow: 2.0, minChroma: 0.02, bins: 24,
    // Штраф тёплой полосе — остатку кожи, переживающему вычитание. Без него
    // приглушённый лак ему проигрывал: у снимков «зелёный маникюр» главная
    // цветная корзина лежала на 53–68°, то есть на коже, а не на ногтях, и
    // зелёный угадывался в 16% случаев. Со штрафом — в 67%. Красный и синий
    // ярче остатка и штраф переживают; оранжевый теряет первое место, но
    // остаётся в тройке.
    warmHi: 50, warmPen: 0.35,
  };

  // Возвращает [оттенок, насыщенность, светлота, цветность].
  // Цветность (max−min) — отдельно от насыщенности HSL не просто так: у HSL она
  // взрывается на тёмных пикселях, и затенённая кожа RGB(40,20,10) получала
  // столько же, сколько яркий лак. На этом первые версии и ломались.
  function toHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l, 0];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l, d];
  }

  // Чистый цвет → группа колоды. Границы сверены с разметкой самой колоды
  // (245 оттенков, совпадение 86%): бирюза до 196° считается зелёной, пастель
  // сохраняет свой оттенок, тёмный цветной остаётся цветным.
  function colorGroup(h, s, l) {
    if (l >= CT.lightL && s < CT.lightS) return 'Светлые';
    if (l <= CT.darkL) return 'Тёмные';
    if (s < CT.grayS) return l >= CT.lightL ? 'Светлые' : (l <= CT.darkL ? 'Тёмные' : 'Нюд и бежевые');
    if (h < CT.red2 || h >= CT.pink2) return 'Красные';
    if (h < CT.orange) return 'Оранжевые';
    if (h < CT.yellow) return 'Жёлтые';
    if (h < CT.green) return 'Зелёные и бирюзовые';
    if (h < CT.blue) return 'Синие';
    if (h < CT.violet) return 'Фиолетовые';
    return 'Розовые';
  }

  // Кандидаты по фотографии, по убыванию уверенности. Пусто — значит не знаем.
  //
  // На типовом снимке маникюра кожа занимает около 70% кадра, а ногти 2–3%.
  // Перевес в двадцать раз никаким взвешиванием не переломить, поэтому кожа
  // не приглушается, а вычитается: по её же кластеру считаем, насколько она
  // насыщена ИМЕННО здесь (у смуглой руки при тёплом свете иначе, чем у
  // светлой при дневном), и отбрасываем всё, что в её полосе оттенков и не
  // ярче найденного порога. Красный и коралловый лак кожу ярче и остаются.
  function detectColors(px, S) {
    const N = S * S, B = CT.bins, step = 360 / B;
    const skin = []; let skinN = 0;
    for (let i = 0; i < N; i++) {
      const j = i * 4;
      const a = toHsl(px[j], px[j + 1], px[j + 2]);
      if (a[2] < 0.08 || a[2] > 0.96) continue;
      if (a[3] >= CT.bgSat && a[0] >= CT.skinLo && a[0] < CT.skinHi) { skin.push(a[3]); skinN++; }
    }
    let cut = 0;
    if (skinN / N >= CT.skinMinShare) {
      skin.sort((x, y) => x - y);
      cut = skin[Math.floor(skin.length * CT.skinPct)] + CT.skinMargin;
    }
    const vote = new Float64Array(B), sumL = new Float64Array(B), sumS = new Float64Array(B);
    let kept = 0;
    for (let i = 0; i < N; i++) {
      const j = i * 4;
      const [h, s, l, c] = toHsl(px[j], px[j + 1], px[j + 2]);
      if (l < 0.08 || l > 0.96) continue;
      if (c < CT.bgSat) continue;                                   // фон
      if (h >= CT.skinLo && h < CT.skinHi && c < cut) continue;      // кожа
      const b = Math.floor(h / step) % B, w = Math.pow(c, CT.satPow);
      vote[b] += w; sumL[b] += w * l; sumS[b] += w * s; kept++;
    }
    // Цветного почти нет: либо нюд, либо белый или чёрный лак. Различить их от
    // фона нечем — молчим. Порог поднят с 0.004 до 0.02 по замеру на 248
    // реальных снимках: неверных подсказок на нюде и бело-чёрном стало 25
    // вместо 42, точность показанного выросла с 75% до 81% в тройке. Ценой
    // того, что на 24 цветных работах из 173 мы тоже промолчим — там мастер
    // выберет сам. Промолчать дешевле, чем подсунуть неверное: неверное он
    // не заметит.
    if (kept / N <= CT.minChroma) return [];

    // Складываем с соседями: оттенок лака размазан бликом и тенью, без этого
    // один цвет проигрывает сам себе, разделившись на две корзины.
    const items = [];
    for (let b = 0; b < B; b++) {
      if (vote[b] <= 0) continue;
      const hue = b * step + step / 2;
      let w = vote[(b + B - 1) % B] * 0.5 + vote[b] + vote[(b + 1) % B] * 0.5;
      if (hue < CT.warmHi) w *= CT.warmPen;   // остаток кожи, см. warmPen
      items.push({ w, g: colorGroup(hue, sumS[b] / vote[b], sumL[b] / vote[b]) });
    }
    items.sort((a, b) => b.w - a.w);
    const out = [], seen = new Set();
    for (const it of items) {
      if (!seen.has(it.g)) { seen.add(it.g); out.push(it.g); }
      if (out.length >= 3) break;
    }
    return out;
  }

  // Цвет в точке, куда ткнул мастер. Берём не один пиксель, а медиану по
  // кружку: один пиксель может попасть в блик и дать белый на красном лаке.
  function colorAtPoint(px, S, cx, cy) {
    const R = Math.max(2, Math.round(S * 0.035));
    const rs = [], gs = [], bs = [];
    for (let y = Math.max(0, cy - R); y <= Math.min(S - 1, cy + R); y++) {
      for (let x = Math.max(0, cx - R); x <= Math.min(S - 1, cx + R); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const j = (y * S + x) * 4;
        rs.push(px[j]); gs.push(px[j + 1]); bs.push(px[j + 2]);
      }
    }
    if (!rs.length) return null;
    const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
    const [h, s, l] = toHsl(med(rs), med(gs), med(bs));
    return colorGroup(h, s, l);
  }

  // Пиксели картинки в квадрате S×S. Работает и для уже загруженных работ:
  // сервер отдаёт uploads с Access-Control-Allow-Origin: *, поэтому холст не
  // «пачкается» и читается. Значит подсказки есть и для старых фото.
  function readPixels(img, S) {
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    // заполняем квадрат по короткой стороне, как crop по центру
    const k = Math.max(S / img.naturalWidth, S / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    try { return ctx.getImageData(0, 0, S, S).data; } catch (e) { return null; }
  }

  // «Разберу потом» — значение по умолчанию: цвет спросим после загрузки.
  // «Без цвета» отличается от него только тем, что после загрузки мы не зовём
  // разбор: работа осознанно остаётся в витрине и в колоду не идёт. Оно стоит
  // последним, потому что когда-то было первым и выбранным — мастер жал
  // «Добавить фото», не трогая список, и колода после этого не собиралась.
  const LATER = '__later__';
  const NO_COLOR = '__none__';
  {
    const o = document.createElement('option');
    // Коротко: закрытый <select> рисует выбранный пункт одной строкой и на
    // узком экране обрезает её вбок — а перенести её на две строки нельзя,
    // это отрисовка системного списка. Длина считана с запасом на крупный
    // системный шрифт. Что цвет подскажем — сказано в подписи над списком,
    // там место под две строки есть.
    o.value = LATER; o.textContent = 'Разберу потом';
    o.selected = true;
    $('uploadColor').appendChild(o);
  }
  // Один цвет на всю пачку остаётся: если мастер грузит двадцать красных работ,
  // выбрать цвет один раз быстрее, чем разбирать двадцать штук по одной.
  COLORS.forEach((c) => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    $('uploadColor').appendChild(o);
  });
  // Тот же список — в форму визита. Цвет там необязателен: мастер может просто
  // записать, что делали, словами.
  if ($('ccVisitColor')) {
    const none = document.createElement('option'); none.value = ''; none.textContent = '— не указывать —';
    $('ccVisitColor').appendChild(none);
    COLORS.forEach((c) => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      $('ccVisitColor').appendChild(o);
    });
  }
  {
    const o = document.createElement('option');
    o.value = NO_COLOR; o.textContent = 'Без цвета';
    $('uploadColor').appendChild(o);
  }

  $('fileInput').addEventListener('change', async () => {
    const files = [...$('fileInput').files]; if (!files.length) return;
    const picked = $('uploadColor').value;
    const color = (picked === NO_COLOR || picked === LATER) ? '' : picked;
    // Что уже лежало в витрине — чтобы после загрузки отличить новые работы от
    // старых. Разбор зовём только на новых: работы, которым цвет сняли осознанно
    // («только в витрину»), в очередь тянуть незачем.
    const had = new Set(lastWorks.map((w) => w.id));
    $('workErr').textContent = ''; $('addWorkBtn').disabled = true;
    let done = 0, err = '';
    for (const f of files) {
      $('addWorkBtn').textContent = 'Загружаю ' + (done + 1) + ' из ' + files.length + '…';
      const { blob, type } = await compress(f);
      // цвет — параметром адреса: в заголовки кириллицу класть нельзя
      const params = new URLSearchParams();
      if (color) params.set('color', color);
      if ($('uploadLength').value) params.set('length', $('uploadLength').value);
      if ($('uploadShape').value) params.set('shape', $('uploadShape').value);
      const path = '/api/master/photos' + (params.toString() ? '?' + params.toString() : '');
      const r = await api(path, { method: 'POST', headers: { 'Content-Type': type || 'image/jpeg' }, body: blob });
      if (r.status === 415) { err = 'Одно из фото — не картинка (нужен jpg, png или webp)'; break; }
      if (r.status === 409) { err = 'Достигнут предел — ' + MAX_WORKS + ' работ'; break; }
      if (!r.ok) { err = 'Не удалось загрузить'; break; }
      done++;
    }
    $('fileInput').value = '';
    $('addWorkBtn').disabled = false;
    $('addWorkBtn').textContent = 'Добавить фото работы';
    $('workErr').textContent = err;
    if (done) toast(done === 1 ? 'Работа добавлена' : 'Добавлено работ: ' + done);
    await loadWorks();
    // «Разберу после загрузки» — обещание, которое надо сдержать сразу: иначе
    // мастер закроет вкладку, и работы останутся без цвета, то есть вне колоды.
    if (done && picked === LATER) openSorter(lastWorks.filter((w) => !had.has(w.id)));
  });

  // Плитки — рабочий инструмент (разложить по цветам, удалить), а не альбом:
  // при двух сотнях работ до соседних карточек кабинета пришлось бы мотать
  // экранами. Показываем девять — ровно три ряда, — остальное по кнопке.
  // Смотреть работы крупно нужно в «Альбоме», он ниже.
  const WORKS_STEP = 9;
  let worksShown = WORKS_STEP;

  async function loadWorks(keepShown) {
    const r = await apiJson('/api/master/photos');
    const works = r.body.works || [];
    lastWorks = works;
    if (!keepShown) worksShown = WORKS_STEP;
    $('workCount').textContent = works.length + ' / ' + MAX_WORKS;
    $('albumBtn').classList.toggle('hidden', works.length === 0);
    const more = $('worksMore');
    const left = works.length - worksShown;
    more.classList.toggle('hidden', left <= 0);
    if (left > 0) {
      const word = left % 10 === 1 && left % 100 !== 11 ? 'работа' :
        [2, 3, 4].includes(left % 10) && ![12, 13, 14].includes(left % 100) ? 'работы' : 'работ';
      more.textContent = 'Показать остальные — ещё ' + left + ' ' + word;
    }
    const box = $('works'); box.innerHTML = '';
    works.slice(0, worksShown).forEach((w, i) => {
      const d = document.createElement('div'); d.className = 'work';
      const img = document.createElement('img'); img.src = abs(w.url); img.alt = 'работа'; img.loading = 'lazy';
      const b = document.createElement('button'); b.textContent = '×'; b.title = 'Удалить';
      b.addEventListener('click', async () => { await api('/api/master/photos/' + w.id, { method: 'DELETE' }); loadWorks(true); refreshDeck(); });

      // На миниатюре оставляем только фото и удаление: параметры разметки
      // редактируются в альбоме, где работу можно рассмотреть крупно.
      d.classList.toggle('nocolor', !w.color);

      img.addEventListener('click', () => openAlbum(i));
      d.appendChild(img); d.appendChild(b); box.appendChild(d);
    });
    paintNoColor();
    refreshDeck(works);
  }

  // Сколько работ ещё не разложено по цветам. Без этого мастер видел только
  // серую кнопку публикации и подсказку «проставьте цвета» — не понимая,
  // сколько их и где они.
  // --- Разбор работ по цветам ----------------------------------------------
  //
  // Раньше цвет проставлялся списком на плитке шириной в треть экрана. Это и
  // есть та работа, из-за которой колоду заполнили четверо из двадцати трёх:
  // фото надо было заранее разложить по цветам и грузить пачками, иначе потом
  // править каждую плитку по отдельности.
  //
  // Здесь работы идут по одной крупно, с подсказкой сверху. Не угадали —
  // мастер тыкает в ноготь прямо на фото: он-то знает, где ноготь, а алгоритм
  // не знает, и это единственный способ получить сто процентов точности.
  const SORT_S = 96;                 // сторона квадрата для разбора пикселей
  let sortQueue = [], sortPos = 0, sortPx = null;
  // Крупная копия того же кадра. Нужна для лупы: ноготь на фото занимает
  // считанные пиксели, и попасть в него пальцем без увеличения невозможно —
  // палец закрывает ровно то место, куда целишься. По ней же берём цвет
  // точки: на копии 96×96 один ноготь это два-три пикселя, и промах в один
  // даёт цвет кожи вместо лака.
  const BIG_S = 900;
  let sortBig = null;
  // Последний загруженный список работ. Объявлен здесь, рядом с остальным
  // состоянием разбора, а не ниже по файлу: заполняет его loadWorks(), которая
  // объявлена ВЫШЕ, и при объявлении под ней любой вызов загрузки до этой
  // строки молча обнулял бы список — кнопка «Разложить по цветам» переставала
  // бы работать без единой ошибки в консоли.
  let lastWorks = [];

  function openSorter(works, includeColored) {
    sortQueue = includeColored ? works.filter(Boolean) : works.filter((w) => !w.color);
    if (!sortQueue.length) return;
    sortPos = 0;
    $('sorter').classList.remove('hidden');
    showSortItem();
  }
  function closeSorter() {
    $('sorter').classList.add('hidden');
    sortQueue = []; sortPx = null;
    loadWorks();
  }

  function chip(text, onClick, cls, color) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sorter-chip' + (cls ? ' ' + cls : '');
    b.textContent = text;
    b.dataset.color = color;
    b.addEventListener('click', onClick);
    return b;
  }

  function showSortItem() {
    if (sortPos >= sortQueue.length) {
      toast(sortQueue.length === 1 ? 'Работа разобрана' : 'Все работы разобраны');
      closeSorter();
      return;
    }
    const w = sortQueue[sortPos];
    sortPx = null; sortBig = null;
    hideLoupe();
    $('sorterCount').textContent = (sortPos + 1) + ' из ' + sortQueue.length;
    $('sorterAll').classList.add('hidden');
    $('sorterGuess').innerHTML = '';
    $('sorterHint').textContent = 'Определяем цвет…';

    const img = $('sorterImg');
    // crossOrigin обязателен: без него холст «пачкается» и пиксели не прочесть.
    // Сервер отдаёт uploads с Access-Control-Allow-Origin: *, так что проходит.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      sortPx = readPixels(img, SORT_S);
      sortBig = readPixels(img, BIG_S);
      const guess = sortPx ? detectColors(sortPx, SORT_S) : [];
      $('sorterGuess').innerHTML = '';
      if (guess.length) {
        $('sorterHint').textContent = 'Похоже на это. Не угадали — ткните в ноготь на фото';
        guess.forEach((g) => $('sorterGuess').appendChild(chip(SHORT[g] || g, () => setSortColor(g), '', g)));
      } else {
        // Молчим осознанно: белый и чёрный лак от фона не отличить, а неверная
        // подсказка хуже отсутствующей — её не заметят.
        $('sorterHint').textContent = 'Цвет не распознан. Ткните в ноготь на фото или выберите ниже';
      }
      // Светлые, нюд и тёмные показываем ВСЕГДА, отдельным рядом. Алгоритм их
      // не находит в принципе: ахроматичный пиксель неотличим от фона, а
      // молочный маникюр он и вовсе принимает за тёплый — на живой работе
      // мастера выдал «Красные · Оранжевые · Жёлтые» для белого омбре. Три
      // самых частых в жизни цвета не должны прятаться в общем списке из
      // десяти только потому, что распознавание про них не знает.
      const plain = ['Светлые', 'Нюд и бежевые', 'Тёмные'].filter((c) => guess.indexOf(c) === -1);
      const row = $('sorterPlain');
      row.innerHTML = '';
      plain.forEach((c) => row.appendChild(chip(SHORT[c] || c, () => setSortColor(c), '', c)));
      row.classList.toggle('hidden', !plain.length);
    };
    img.onerror = () => { $('sorterHint').textContent = 'Фото не загрузилось'; };
    img.src = abs(w.url);
  }

  // Лупа. Ноготь на снимке — несколько пикселей, палец закрывает и его, и
  // окрестность, поэтому «ткнуть в ноготь» без увеличения не работает: это
  // первое, обо что споткнулся мастер. Пока палец на фото, над ним висит
  // кружок с увеличенным куском кадра, перекрестием в центре и названием
  // цвета под ним. Отпустил — цвет становится первой подсказкой.
  const LOUPE = 108;      // размер кружка на экране
  // Во сколько раз крупнее, чем видно на экране. Считать надо именно так, а не
  // «во сколько раз растянуть исходник»: при фиксированном растяжении кружок
  // брал два десятка пикселей копии и раздувал их впятеро — картинка плыла и
  // разобрать в ней ноготь было нельзя. Сколько пикселей копии взять, теперь
  // вычисляем из размера фото на экране.
  const LOUPE_Z = 3.5;

  function hideLoupe() {
    const l = $('sorterLoupe');
    if (l) l.classList.add('hidden');
  }

  // Куда пришлось нажать, в долях от размера картинки
  function relPoint(e) {
    const img = $('sorterImg'), r = img.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || e;
    return {
      x: (t.clientX - r.left) / r.width,
      y: (t.clientY - r.top) / r.height,
      cx: t.clientX, cy: t.clientY, rect: r,
    };
  }

  function drawLoupe(p) {
    if (!sortBig) return null;
    const l = $('sorterLoupe'), cv = $('sorterLoupeCv');
    const px = Math.min(BIG_S - 1, Math.max(0, Math.round(p.x * (BIG_S - 1))));
    const py = Math.min(BIG_S - 1, Math.max(0, Math.round(p.y * (BIG_S - 1))));
    // Сколько пикселей копии показать в кружке, чтобы вышло ровно в LOUPE_Z раз
    // крупнее экранного вида: переводим размер кружка в экранные пиксели, а их
    // — в пиксели копии.
    const scale = BIG_S / Math.max(1, p.rect.width);
    const src = Math.max(12, Math.round((LOUPE / LOUPE_Z) * scale));
    const half = src >> 1;
    const ctx = cv.getContext('2d');
    const tmp = ctx.createImageData(src, src);
    for (let y = 0; y < src; y++) {
      for (let x = 0; x < src; x++) {
        const sx = Math.min(BIG_S - 1, Math.max(0, px - half + x));
        const sy = Math.min(BIG_S - 1, Math.max(0, py - half + y));
        const a = (sy * BIG_S + sx) * 4, b = (y * src + x) * 4;
        tmp.data[b] = sortBig[a]; tmp.data[b + 1] = sortBig[a + 1];
        tmp.data[b + 2] = sortBig[a + 2]; tmp.data[b + 3] = 255;
      }
    }
    const off = document.createElement('canvas');
    off.width = src; off.height = src;
    off.getContext('2d').putImageData(tmp, 0, 0);
    cv.width = LOUPE; cv.height = LOUPE;
    ctx.clearRect(0, 0, LOUPE, LOUPE);
    // Сглаживание включено: кроп теперь близок к размеру кружка, растягивать
    // почти нечего, и жёсткие пиксели дали бы рябь на ровном лаке.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, LOUPE, LOUPE);

    const g = colorAtPoint(sortBig, BIG_S, px, py);
    $('sorterLoupeName').textContent = g ? (SHORT[g] || g) : '';
    // Кружок над пальцем. Снизу его держит палец, сверху — край экрана: над
    // кружком висит подпись цвета (её перенесли наверх, потому что снизу палец
    // её закрывал), и ей тоже нужно место, иначе название уедет за экран.
    const NAME_H = 34;
    const minTop = LOUPE / 2 + NAME_H + 6;
    l.style.left = Math.round(Math.min(window.innerWidth - LOUPE / 2 - 6,
      Math.max(LOUPE / 2 + 6, p.cx))) + 'px';
    l.style.top = Math.round(Math.max(minTop, p.cy - LOUPE * 0.9)) + 'px';
    l.classList.remove('hidden');
    return g;
  }

  let loupeColor = null;
  const imgEl = () => $('sorterImg');

  function onPress(e) {
    if (!sortBig) return;
    e.preventDefault();
    loupeColor = drawLoupe(relPoint(e));
  }
  function onRelease() {
    hideLoupe();
    if (!loupeColor) return;
    const g = loupeColor; loupeColor = null;
    // Найденное НЕ сохраняем сразу, а ставим первой подсказкой. Верна только
    // точка, а не вывод из неё: нюдовый лак лежит в той же тёплой полосе
    // оттенков, что и кожа. Поэтому решает мастер, а лупа экономит ему выбор
    // из десяти, а не подменяет его.
    const box = $('sorterGuess');
    const rest = Array.prototype.map.call(box.children, (b) => b.dataset.color)
      .filter((c) => c && c !== g).slice(0, 2);
    box.innerHTML = '';
    box.appendChild(chip(SHORT[g] || g, () => setSortColor(g), 'sorter-picked', g));
    rest.forEach((c) => box.appendChild(chip(SHORT[c] || c, () => setSortColor(c), '', c)));
    $('sorterHint').textContent = 'В этой точке — «' + (SHORT[g] || g) + '». Нажмите, если верно';
  }

  ['touchstart', 'touchmove'].forEach((ev) =>
    imgEl().addEventListener(ev, onPress, { passive: false }));
  ['touchend', 'touchcancel'].forEach((ev) =>
    imgEl().addEventListener(ev, onRelease));
  // Мышью — то же самое: кабинет открывают и с компьютера
  imgEl().addEventListener('mousedown', onPress);
  imgEl().addEventListener('mousemove', (e) => { if (loupeColor !== null) onPress(e); });
  imgEl().addEventListener('mouseup', onRelease);
  imgEl().addEventListener('mouseleave', () => { hideLoupe(); loupeColor = null; });

  async function setSortColor(color) {
    const w = sortQueue[sortPos];
    const res = await api('/api/master/photos/' + w.id + '/color', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: color }),
    });
    if (!res.ok) { toast('Не удалось сохранить цвет'); return; }
    sortPos++;
    showSortItem();
  }

  $('sorterClose').addEventListener('click', closeSorter);
  $('sorterSkip').addEventListener('click', () => { sortPos++; showSortItem(); });
  $('sorterMore').addEventListener('click', () => {
    const box = $('sorterAll');
    box.classList.toggle('hidden');
    if (!box.innerHTML) COLORS.forEach((c) => box.appendChild(chip(SHORT[c] || c, () => setSortColor(c), '', c)));
  });

  // Считаем по списку работ, а не по плиткам на экране: плиток показано
  // девять, а работ без цвета может быть сорок — и предупреждение молчало бы.
  function paintNoColor() {
    const warn = $('noColorWarn');
    if (!warn) return;
    const left = lastWorks.filter((w) => !w.color).length;
    warn.classList.toggle('hidden', left === 0);
    // Метка на вкладке: само предупреждение лежит теперь на «Работах», и с
    // «Главного» его не видно.
    const dot = $('tabWorksDot');
    if (dot) dot.classList.toggle('hidden', left === 0);
    if (!left) return;
    const word = left % 10 === 1 && left % 100 !== 11 ? 'работа' :
      [2, 3, 4].includes(left % 10) && ![12, 13, 14].includes(left % 100) ? 'работы' : 'работ';
    warn.innerHTML = '';
    const p = document.createElement('div');
    p.innerHTML = '<b>Без цвета: ' + left + ' ' + word + '.</b> ' +
      'Они видны в витрине, но в вашу колоду не попадут — колода собирается по цветам. ' +
      'Разберём по одной: подскажем цвет, поправите одним касанием.';
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.textContent = 'Разложить по цветам';
    btn.addEventListener('click', () => openSorter(lastWorks));
    warn.appendChild(p); warn.appendChild(btn);
  }

  // --- Альбом: работы крупно ------------------------------------------------
  //
  // Плитка — треть ширины экрана: по ней видно, что фото загрузилось, и больше
  // ничего. Мастер показывает работы клиентке и проверяет их сам — для этого
  // нужен нормальный размер. Отдельная кнопка и касание по плитке ведут сюда.
  let albumPos = 0;
  const ALBUM_LENGTHS = [['', 'Не указана'], ['short', 'Короткие'], ['medium', 'Средние'], ['long', 'Длинные']];
  const ALBUM_SHAPES = [['', 'Не указана'], ['square', 'Квадрат'], ['soft-square', 'Мягкий квадрат'], ['oval', 'Овал'], ['almond', 'Миндаль'], ['stiletto', 'Стилет']];

  function fillAlbumSelect(id, items, value) {
    const select = $(id);
    select.replaceChildren();
    items.forEach(([key, label]) => {
      const option = document.createElement('option');
      option.value = key; option.textContent = label;
      select.appendChild(option);
    });
    select.value = value || '';
  }

  function openAlbum(pos) {
    if (!lastWorks.length) { toast('Пока нет ни одной работы'); return; }
    albumPos = Math.min(Math.max(pos | 0, 0), lastWorks.length - 1);
    $('album').classList.remove('hidden');
    showAlbumItem();
  }
  function closeAlbum() { $('album').classList.add('hidden'); }
  function albumStep(d) {
    if (!lastWorks.length) return;
    // По кругу: на последней работе «вперёд» возвращает к первой, иначе
    // пролистывание упирается в стену без объяснений.
    albumPos = (albumPos + d + lastWorks.length) % lastWorks.length;
    showAlbumItem();
  }
  function showAlbumItem() {
    const w = lastWorks[albumPos];
    if (!w) { closeAlbum(); return; }
    $('albumImg').src = abs(w.url);
    $('albumCount').textContent = (albumPos + 1) + ' из ' + lastWorks.length;
    $('albumCap').textContent = w.color || 'без цвета — в колоду не попадёт';
    fillAlbumSelect('albumColor', [['', 'Не указан'], ...COLORS.map((c) => [c, SHORT[c] || c])], w.color);
    fillAlbumSelect('albumLength', ALBUM_LENGTHS, w.length);
    fillAlbumSelect('albumShape', ALBUM_SHAPES, w.shape);
    $('albumStatus').textContent = '';
    // Соседний кадр в кеш: иначе при листании белый экран на полсекунды.
    const next = lastWorks[(albumPos + 1) % lastWorks.length];
    if (next) new Image().src = abs(next.url);
  }

  async function saveAlbumMeta() {
    const w = lastWorks[albumPos];
    if (!w) return;
    const color = $('albumColor').value;
    const length = $('albumLength').value;
    const shape = $('albumShape').value;
    const changes = [];
    if ((w.color || '') !== color) changes.push(['/api/master/photos/' + w.id + '/color', { color }]);
    if ((w.length || '') !== length || (w.shape || '') !== shape) {
      changes.push(['/api/master/photos/' + w.id + '/fit', { length, shape }]);
    }
    if (!changes.length) return;
    const controls = [$('albumColor'), $('albumLength'), $('albumShape')];
    controls.forEach((control) => { control.disabled = true; });
    $('albumStatus').textContent = 'Сохраняем…';
    try {
      for (const [path, body] of changes) {
        const res = await api(path, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('save failed');
      }
      w.color = color; w.length = length; w.shape = shape;
      $('albumCap').textContent = color || 'без цвета — в колоду не попадёт';
      paintNoColor();
      refreshDeck();
      $('albumStatus').textContent = 'Сохранено';
    } catch (e) {
      $('albumStatus').textContent = 'Не удалось сохранить';
      toast('Не удалось сохранить параметры работы');
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  }

  $('albumBtn').addEventListener('click', () => openAlbum(0));
  $('albumClose').addEventListener('click', closeAlbum);
  $('albumPrev').addEventListener('click', () => albumStep(-1));
  $('albumNext').addEventListener('click', () => albumStep(1));
  $('albumColor').addEventListener('change', saveAlbumMeta);
  $('albumLength').addEventListener('change', saveAlbumMeta);
  $('albumShape').addEventListener('change', saveAlbumMeta);
  $('albumSuggest').addEventListener('click', () => {
    const w = lastWorks[albumPos];
    if (!w) return;
    closeAlbum();
    openSorter([w], true);
  });
  document.addEventListener('keydown', (e) => {
    if ($('album').classList.contains('hidden')) return;
    if (e.key === 'Escape') closeAlbum();
    if (e.key === 'ArrowLeft') albumStep(-1);
    if (e.key === 'ArrowRight') albumStep(1);
  });
  {
    // Свайп по фото. Порог в 40px, чтобы обычное касание не листало.
    let x0 = null, y0 = null;
    const stage = $('albumStage');
    stage.addEventListener('touchstart', (e) => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      // Вертикальное движение — это прокрутка, а не листание.
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) albumStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  $('worksMore').addEventListener('click', () => {
    worksShown = lastWorks.length;
    loadWorks(true);
  });


  // --- Клиенты ---------------------------------------------------------------
  //
  // Единственная часть кабинета, ради которой его открывают на КАЖДОМ приёме,
  // а не один раз из любопытства. Выбор клиентки — это её желание, визит — то,
  // что вышло; совпадают они далеко не всегда, поэтому и хранятся отдельно.
  //
  // Список сам заполняется из выборов: клиентка называется, когда нажимает
  // «Показать мастеру», и карточка заводится на сервере без участия мастера.
  const CLIENTS_STEP = 12;
  let clientsAll = [], clientsShown = CLIENTS_STEP, clientQuery = '';
  // Без Pro сервер отдаёт 10 последних карточек и говорит, сколько скрыто.
  let clientsHidden = 0, clientsLimit = null;
  let ccId = null, ccPhotoUrl = '';

  const dmy = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };
  const isoDate = (ts) => {
    const d = ts ? new Date(ts) : new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  // Дату из <input type=date> берём как полдень по местному времени: полночь на
  // некоторых часовых поясах уезжает на день назад при обратном пересчёте.
  const fromIso = (v) => (v ? new Date(v + 'T12:00:00').getTime() : null);

  async function loadClients(keepShown) {
    const r = await apiJson('/api/master/clients');
    if (!r.ok) return;
    clientsAll = r.body.clients || [];
    clientsHidden = r.body.hidden || 0;
    clientsLimit = r.body.limit || null;
    if (!keepShown) clientsShown = CLIENTS_STEP;
    renderClients();
  }

  // Ключ телефона — последние десять цифр, ровно как на сервере: номер без кода
  // страны. +7 (912) 345-67-89 и 8 912 345 67 89 — один и тот же 9123456789.
  const phoneKey = (raw) => {
    const d = String(raw || '').replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
  };
  const digitsOf = (raw) => String(raw || '').replace(/\D/g, '');

  // Ищем по имени ИЛИ по телефону, глядя на сам запрос: цифры — значит телефон.
  // Полный номер (десять цифр и больше) сравниваем ключами — это тот же номер,
  // как бы он ни был записан. Набрали меньше — ищем вхождением: это не
  // «совпадение номера», а поиск по началу или хвосту, пока набирают.
  function matchClient(c, q) {
    if (!q) return true;
    const qd = digitsOf(q);
    if (qd.length >= 3) {
      const key = phoneKey(q);
      if (key) { if (c.phoneKey === key) return true; }
      else if (digitsOf(c.phone).includes(qd)) return true;
      // Цифры в запросе не обязаны означать телефон — имя тоже проверим.
    }
    return c.name.toLowerCase().includes(q.toLowerCase());
  }

  function renderClients() {
    const box = $('clientList');
    if (!box) return;
    const q = clientQuery.trim();
    const list = q ? clientsAll.filter((c) => matchClient(c, q)) : clientsAll;
    const total = clientsAll.length + clientsHidden;
    $('clientCount').textContent = total ? total : '';
    $('clientsEmpty').classList.toggle('hidden', total > 0);
    // Скрытые лимитом — не пропажа: говорим, сколько их и что они сохранены.
    if ($('clientsLocked')) {
      $('clientsLocked').classList.toggle('hidden', !clientsHidden);
      $('clientsLockedText').textContent = clientsHidden
        ? 'Скрыто карточек: ' + clientsHidden + '. Без Pro видны ' + clientsLimit
          + ' последних, остальные сохранены и откроются с Pro.'
        : '';
    }
    box.innerHTML = '';

    const more = $('clientMore');
    const left = list.length - clientsShown;
    more.classList.toggle('hidden', left <= 0);
    if (left > 0) more.textContent = 'Показать всех — ещё ' + left;

    list.slice(0, clientsShown).forEach((c) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'client-row';
      const main = document.createElement('div'); main.style.minWidth = '0';
      const nm = document.createElement('div'); nm.className = 'client-name'; nm.textContent = c.name;
      const sub = document.createElement('div'); sub.className = 'client-sub';
      const parts = [];
      if (c.phone) parts.push(c.phone);
      if (c.visits) parts.push('визитов: ' + c.visits);
      if (c.picks) parts.push('выборов: ' + c.picks);
      const last = c.lastVisit || c.lastPick;
      if (last) parts.push('была ' + dmy(last));
      sub.textContent = parts.join(' · ') || 'ещё ничего';
      main.appendChild(nm); main.appendChild(sub);
      b.appendChild(main);

      if (c.nextAt) {
        const when = document.createElement('div'); when.className = 'client-when';
        when.innerHTML = 'придёт<b>' + dmy(c.nextAt) + '</b>';
        b.appendChild(when);
      }
      b.addEventListener('click', () => openClient(c.id));
      li.appendChild(b); box.appendChild(li);
    });
  }

  if ($('clientSearch')) {
    $('clientSearch').addEventListener('input', () => {
      clientQuery = $('clientSearch').value || '';
      clientsShown = CLIENTS_STEP;
      renderClients();
    });
  }
  if ($('clientMore')) {
    $('clientMore').addEventListener('click', () => { clientsShown = clientsAll.length; renderClients(); });
  }
  if ($('clientsProBtn')) $('clientsProBtn').addEventListener('click', showProCard);
  if ($('clientAdd')) {
    $('clientAdd').addEventListener('click', async () => {
      const name = (prompt('Имя клиента') || '').trim();
      if (name.length < 2) return;
      const r = await apiJson('/api/master/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (r.body && r.body.error === 'clients_limit') {
        toast('Без Pro — до ' + r.body.limit + ' карточек, с Pro — без ограничения');
        showProCard();
        return;
      }
      if (!r.ok) { toast('Не удалось добавить'); return; }
      await loadClients();
      openClient(r.body.id);
    });
  }

  // --- Карточка одного клиента -----------------------------------------------

  async function openClient(id) {
    const r = await apiJson('/api/master/clients/' + encodeURIComponent(id));
    if (r.status === 403) { toast('Эта карточка откроется с Pro'); showProCard(); return; }
    if (!r.ok) { toast('Карточка не открылась'); return; }
    const c = r.body.client;
    ccId = c.id; ccPhotoUrl = '';
    $('ccName').textContent = c.name;
    $('ccNameIn').value = c.name || '';
    $('ccContact').value = c.contact || '';
    $('ccPhone').value = c.phone || '';
    $('ccPhoneWarn').classList.add('hidden');
    $('ccNote').value = c.note || '';
    $('ccNext').value = c.nextAt ? isoDate(c.nextAt) : '';
    $('ccErr').textContent = '';
    renderVisits(c.visits || []);
    renderClientPicks(c.picks || []);
    $('ccVisitForm').classList.add('hidden');
    $('ccVisitPhotoName').classList.add('hidden');
    $('ccVisitDate').value = isoDate();
    $('ccVisitWhat').value = ''; $('ccVisitNote').value = '';
    $('clientCard').classList.remove('hidden');
    // Экран открывается поверх кабинета, и прокрутка под ним остаётся своей —
    // без этого карточка открывалась в том месте, куда был домотан кабинет.
    $('clientCard').scrollTop = 0;
  }

  function closeClient() {
    $('clientCard').classList.add('hidden');
    ccId = null;
  }

  function renderVisits(visits) {
    const box = $('ccVisits'); box.innerHTML = '';
    $('ccVisitCount').textContent = visits.length ? visits.length : '';
    $('ccVisitsEmpty').classList.toggle('hidden', visits.length > 0);
    visits.forEach((v) => {
      const row = document.createElement('div'); row.className = 'visit';
      if (v.photoUrl) {
        const img = document.createElement('img');
        img.src = abs(v.photoUrl); img.alt = 'Результат'; img.loading = 'lazy';
        row.appendChild(img);
      }
      const main = document.createElement('div'); main.className = 'visit-main';
      const when = document.createElement('div'); when.className = 'visit-when';
      when.textContent = new Date(v.doneAt).toLocaleDateString('ru-RU',
        { day: 'numeric', month: 'long', year: 'numeric' });
      const what = document.createElement('div'); what.className = 'visit-what';
      what.textContent = [v.label, v.color].filter(Boolean).join(' · ') || 'Визит';
      main.appendChild(when); main.appendChild(what);
      if (v.note) {
        const n = document.createElement('div'); n.className = 'visit-note'; n.textContent = v.note;
        main.appendChild(n);
      }
      row.appendChild(main);

      const del = document.createElement('button');
      del.className = 'visit-del'; del.type = 'button'; del.textContent = '×'; del.title = 'Удалить визит';
      del.addEventListener('click', async () => {
        if (!confirm('Удалить эту запись?')) return;
        const r = await api('/api/master/visits/' + encodeURIComponent(v.id), { method: 'DELETE' });
        if (!r.ok) { toast('Не удалось удалить'); return; }
        openClient(ccId); loadClients(true);
      });
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  function renderClientPicks(picks) {
    const box = $('ccPicks'); box.innerHTML = '';
    $('ccPickCount').textContent = picks.length ? picks.length : '';
    $('ccPicksEmpty').classList.toggle('hidden', picks.length > 0);
    picks.forEach((p) => {
      const row = document.createElement('div'); row.className = 'cc-pick';
      const img = document.createElement('img');
      img.loading = 'lazy'; img.alt = '';
      const photo = pickPhoto(p);
      if (photo) img.src = photo;
      row.appendChild(img);
      const main = document.createElement('div'); main.style.minWidth = '0';
      const t = document.createElement('div'); t.className = 'cc-pick-t'; t.textContent = pickLabel(p);
      const d = document.createElement('div'); d.className = 'cc-pick-d';
      d.textContent = new Date(p.createdAt || p.created_at).toLocaleDateString('ru-RU',
        { day: 'numeric', month: 'long' });
      main.appendChild(t); main.appendChild(d);
      row.appendChild(main);
      box.appendChild(row);
    });
  }

  if ($('ccBack')) $('ccBack').addEventListener('click', closeClient);

  if ($('ccSave')) {
    $('ccSave').addEventListener('click', async () => {
      if (!ccId) return;
      const name = ($('ccNameIn').value || '').trim();
      if (name.length < 2) { $('ccErr').textContent = 'Имя слишком короткое'; return; }
      $('ccSave').disabled = true;
      const r = await apiJson('/api/master/clients/' + encodeURIComponent(ccId), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contact: $('ccContact').value || '',
          phone: $('ccPhone').value || '',
          note: $('ccNote').value || '',
          nextAt: fromIso($('ccNext').value),
        }),
      });
      $('ccSave').disabled = false;
      if (!r.ok) { $('ccErr').textContent = 'Не удалось сохранить'; return; }
      $('ccErr').textContent = '';
      // Сохранить не мешаем: решать, один это человек или разные, мастеру.
      const same = (r.body && r.body.samePhone) || [];
      $('ccPhoneWarn').classList.toggle('hidden', same.length === 0);
      if (same.length) {
        $('ccPhoneWarn').textContent = 'Этот же номер записан у: ' + same.join(', ')
          + '. Похоже, это один человек — тогда лишнюю карточку можно удалить.';
      }
      $('ccName').textContent = name;
      toast('Сохранено');
      loadClients(true);
    });
  }

  if ($('ccDelete')) {
    $('ccDelete').addEventListener('click', async () => {
      if (!ccId) return;
      if (!confirm('Удалить клиента вместе с записями о визитах? Выборы останутся в общей ленте.')) return;
      const r = await api('/api/master/clients/' + encodeURIComponent(ccId), { method: 'DELETE' });
      if (!r.ok) { toast('Не удалось удалить'); return; }
      closeClient(); loadClients();
    });
  }

  if ($('ccVisitToggle')) {
    $('ccVisitToggle').addEventListener('click', () => {
      $('ccVisitForm').classList.toggle('hidden');
      if (!$('ccVisitForm').classList.contains('hidden')) $('ccVisitWhat').focus();
    });
  }

  if ($('ccVisitPhotoBtn')) {
    $('ccVisitPhotoBtn').addEventListener('click', () => $('ccVisitPhoto').click());
  }
  if ($('ccVisitPhoto')) {
    $('ccVisitPhoto').addEventListener('change', async () => {
      const f = $('ccVisitPhoto').files[0];
      if (!f) return;
      $('ccVisitPhotoBtn').disabled = true;
      $('ccVisitPhotoBtn').textContent = 'Загружаю…';
      try {
        // Сжимаем тем же путём, что и работы витрины: телефон снимает по 3–5 МБ.
        const { blob, type } = await compress(f);
        const r = await apiJson('/api/master/visit-photo', {
          method: 'POST', headers: { 'Content-Type': type || 'image/jpeg' }, body: blob,
        });
        if (!r.ok) throw new Error('upload');
        ccPhotoUrl = r.body.url;
        $('ccVisitPhotoName').textContent = 'Фото готово — сохраните визит';
        $('ccVisitPhotoName').classList.remove('hidden');
      } catch (e) {
        toast('Не удалось загрузить фото');
      }
      $('ccVisitPhoto').value = '';
      $('ccVisitPhotoBtn').disabled = false;
      $('ccVisitPhotoBtn').textContent = 'Фото результата';
    });
  }

  if ($('ccVisitSave')) {
    $('ccVisitSave').addEventListener('click', async () => {
      if (!ccId) return;
      $('ccVisitSave').disabled = true;
      const r = await apiJson('/api/master/clients/' + encodeURIComponent(ccId) + '/visits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doneAt: fromIso($('ccVisitDate').value) || Date.now(),
          label: $('ccVisitWhat').value || '',
          color: $('ccVisitColor').value || '',
          note: $('ccVisitNote').value || '',
          photoUrl: ccPhotoUrl,
        }),
      });
      $('ccVisitSave').disabled = false;
      if (!r.ok) { toast('Не удалось сохранить визит'); return; }
      ccPhotoUrl = '';
      toast('Визит записан');
      openClient(ccId);
      loadClients(true);
    });
  }

  // --- Своя колода мастера ---
  async function refreshDeck(known) {
    const works = known || (await apiJson('/api/master/photos')).body.works || [];
    const byColor = new Map();
    works.forEach((w) => { if (w.color) byColor.set(w.color, (byColor.get(w.color) || 0) + 1); });

    const box = $('deckColors'); box.innerHTML = '';
    [...byColor.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
      const s = document.createElement('span');
      s.innerHTML = c + ' · <b>' + n + '</b>';
      box.appendChild(s);
    });
    $('deckEmpty').classList.toggle('hidden', byColor.size > 0);
    // без цветов публиковать нечего
    $('deckPublish').disabled = byColor.size === 0;
    // и смотреть тоже нечего: пустая колода откроется пустой
    if ($('myDeckBtn')) {
      $('myDeckBtn').disabled = byColor.size === 0;
      $('myDeckNote').textContent = byColor.size
        ? 'Ваши работы, разложенные по цветам, — ровно так, как их видит клиентка. Проверить можно и до того, как включите показ.'
        : 'Пока пусто: колода собирается из работ с проставленным цветом.';
    }
  }

  $('deckPublish').addEventListener('change', async () => {
    $('deckOwnErr').textContent = '';
    const r = await api('/api/master/deck', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: $('deckPublish').checked }),
    });
    if (r.status === 403) { $('deckOwnErr').textContent = 'Своя колода доступна на тарифе Pro'; $('deckPublish').checked = false; return; }
    if (!r.ok) { $('deckOwnErr').textContent = 'Не удалось сохранить'; $('deckPublish').checked = !$('deckPublish').checked; return; }
    toast($('deckPublish').checked ? 'Колода показывается клиентам' : 'Колода скрыта');
  });

  // Согласие на общий раздел — не привязано к наличию работ (в отличие от публикации
  // колоды выше): мастер может согласиться заранее, а работы разложить по цветам потом.
  $('catalogOptIn').addEventListener('change', async () => {
    $('deckOwnErr').textContent = '';
    const r = await api('/api/master/catalog', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optIn: $('catalogOptIn').checked }),
    });
    if (r.status === 403) { $('deckOwnErr').textContent = 'Общая колода доступна на тарифе Pro'; $('catalogOptIn').checked = false; return; }
    if (!r.ok) { $('deckOwnErr').textContent = 'Не удалось сохранить'; $('catalogOptIn').checked = !$('catalogOptIn').checked; return; }
    toast($('catalogOptIn').checked ? 'Запомнили — попадёте в общий раздел на запуске' : 'Участие выключено');
  });

  // --- Выборы клиентов ---
  let lastTopTs = 0;       // время самого свежего выбора (список ограничен 50, счётчик не годится)
  let picksTimer = null;
  // Лента показывается по десять. Сервер отдаёт до пятидесяти выборов, а это
  // около четырёх тысяч пикселей прокрутки: мастер смотрит сюда между
  // клиентами, и ему нужны последние, а не вся история разом.
  const PICKS_STEP = 10;
  let picksAll = [], picksShown = PICKS_STEP;

  if ($('picksMore')) {
    $('picksMore').addEventListener('click', () => {
      picksShown = picksAll.length;
      renderPicks(picksAll, true);
    });
  }

  async function loadPicks() {
    const r = await apiJson('/api/master/picks');
    const picks = r.body.picks || [];
    lastTopTs = picks.length ? picks[0].created_at : 0;
    renderPicks(picks);
  }
  const APP = native ? new URL('../', location.href).href : 'https://mani-magic.ru/app/';
  const deck = () => (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : null;
  const cardOf = (n) => { const d = deck(); return d && d[n - 1] ? d[n - 1] : null; };
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  // «5 минут назад» читается быстрее, чем дата: мастер смотрит это между клиентами
  function whenText(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // Фото выбора на весь экран. Мастер работает одной рукой и смотрит в телефон
  // между клиентами — по подписи «карта 9 · дизайн 2» он не поймёт ничего, ему
  // нужно увидеть саму работу крупно.
  function openPickPhoto(src, title, sub) {
    const box = $('pickPhoto');
    if (!box) return;
    $('pickPhotoImg').src = src;
    $('pickPhotoTitle').textContent = title || '';
    $('pickPhotoSub').textContent = sub || '';
    box.classList.remove('hidden');
    document.body.classList.add('photo-open');   // страница под фото не скроллится
  }
  function closePickPhoto() {
    const box = $('pickPhoto');
    if (!box) return;
    box.classList.add('hidden');
    document.body.classList.remove('photo-open');
    $('pickPhotoImg').src = '';       // не держим картинку в памяти закрытой
    // Сбрасываем след от свайпа: иначе следующее открытие покажет фото уже
    // оттянутым вниз и полупрозрачным.
    const body = $('pickPhotoBody');
    if (body) body.style.transform = '';
    box.style.opacity = '';
  }
  if ($('pickPhoto')) {
    const box = $('pickPhoto');
    const body = $('pickPhotoBody');

    // Свайп вниз закрывает — тот же приём, что в галерее приложения: тянем
    // содержимое за пальцем, гасим фон по мере оттягивания, и если протянули
    // достаточно далеко, закрываем. Крестика нет: жест понятнее и не занимает
    // угол, в который мастер норовит попасть большим пальцем.
    const CLOSE_DIST = 90;
    let startY = null, startX = null;

    const setDrag = (dy) => {
      body.style.transform = dy ? 'translateY(' + dy + 'px)' : '';
      // 260 подобрано так, чтобы к порогу закрытия фон уже заметно поблёк
      box.style.opacity = dy ? String(Math.max(0.35, 1 - dy / 260)) : '';
    };
    const endDrag = (close) => {
      body.style.transition = 'transform .2s ease';
      box.style.transition = 'opacity .2s ease';
      setDrag(0);
      setTimeout(() => { body.style.transition = box.style.transition = ''; }, 220);
      if (close) closePickPhoto();
    };

    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startY = e.changedTouches[0].clientY;
        startX = e.changedTouches[0].clientX;
      } else { startY = startX = null; }
    }, { passive: true });

    box.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      const dy = e.changedTouches[0].clientY - startY;
      const dx = e.changedTouches[0].clientX - startX;
      // тянем только явно вертикальный жест вниз
      if (dy > 0 && dy > Math.abs(dx)) setDrag(dy);
    }, { passive: true });

    box.addEventListener('touchend', (e) => {
      if (startY === null) return;
      const dy = e.changedTouches[0].clientY - startY;
      const dx = e.changedTouches[0].clientX - startX;
      endDrag(dy > Math.abs(dx) && dy > CLOSE_DIST);
      startY = startX = null;
    }, { passive: true });

    // Тап по фону закрывает, тап по самому фото — нет: иначе не разглядеть.
    box.addEventListener('click', (e) => { if (e.target === box) closePickPhoto(); });
    // Escape — для тех, кто открыл кабинет на компьютере: свайпа там нет.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !box.classList.contains('hidden')) closePickPhoto();
    });
  }

  // Миниатюра показывает ИМЕННО ВЫБРАННОЕ, а не лицо карты: мастеру нужно
  // увидеть работу, которую хочет клиентка, а «карта 9 · дизайн 2» ему об этом
  // не говорит ничего. Порядок: работа из витрины → выбранный дизайн карты →
  // лицо карты, если конкретную работу не выбирали.
  // workUrl приходит от API относительным (/uploads/…) — на основном домене без
  // abs() он вёл бы в никуда. Остальные пути уже абсолютные, через APP.
  function pickPhoto(p) {
    const card = cardOf(p.card);
    return abs(p.workUrl)
      || (card && p.design && card.works && card.works[p.design - 1]
        ? APP + card.works[p.design - 1]
        : (p.card ? APP + 'assets/cards/front-' + pad2(p.card) + '.webp' : ''));
  }

  // Название техники берём в первую очередь ИЗ ЗАПИСИ: его прислало приложение
  // в момент выбора, и оно верно, даже если состав работ у карты потом
  // поменяется. Своя копия колоды — только запас для старых записей, где
  // названий ещё не сохраняли.
  function pickLabel(p) {
    const card = cardOf(p.card);
    return p.workUrl
      ? 'Ваша работа из витрины'
      : (p.designLabel
        || (card && p.design && card.workLabels && card.workLabels[p.design - 1])
        || (p.card ? 'Карта ' + p.card : 'Выбор клиента'));
  }

  function renderPicks(picks, keepShown) {
    picksAll = picks;
    if (!keepShown) picksShown = PICKS_STEP;
    const ul = $('picks'); ul.innerHTML = '';
    $('picksEmpty').classList.toggle('hidden', picks.length > 0);
    const more = $('picksMore');
    if (more) {
      const left = picks.length - picksShown;
      more.classList.toggle('hidden', left <= 0);
      if (left > 0) {
        const word = left % 10 === 1 && left % 100 !== 11 ? 'выбор'
          : [2, 3, 4].includes(left % 10) && ![12, 13, 14].includes(left % 100) ? 'выбора' : 'выборов';
        more.textContent = 'Показать все — ещё ' + left + ' ' + word;
      }
    }
    picks.slice(0, picksShown).forEach((p) => {
      const card = cardOf(p.card);
      const li = document.createElement('li');
      li.className = 'pick-row';

      // Миниатюра показывает ИМЕННО ВЫБРАННОЕ, а не лицо карты: мастеру нужно
      // увидеть работу, которую хочет клиентка, а «карта 9 · дизайн 2» ему об
      // этом не говорит ничего. Порядок: работа из витрины → выбранный дизайн
      // карты → лицо карты, если конкретную работу не выбирали.
      // workUrl приходит от API относительным (/uploads/…) — на основном домене
      // без abs() он бы вёл в никуда. Остальные пути уже абсолютные, через APP.
      const photo = pickPhoto(p);
      const img = document.createElement('img');
      img.className = 'pick-thumb';
      img.loading = 'lazy';
      img.alt = p.workUrl ? 'Выбранная работа' : ('Карта ' + p.card);
      if (photo) img.src = photo;
      li.appendChild(img);

      const main = document.createElement('div'); main.className = 'pick-main';

      const title = document.createElement('div'); title.className = 'pick-title';
      if (p.clientName) {
        const nm = document.createElement('span'); nm.className = 'pick-name';
        nm.textContent = p.clientName; title.appendChild(nm);
      }
      // Название техники берём в первую очередь ИЗ ЗАПИСИ: его прислало
      // приложение в момент выбора, и оно верно даже если состав работ у карты
      // потом поменяется. Своя копия колоды — только как запас для старых
      // записей, где названия ещё не сохранялись.
      title.appendChild(document.createTextNode(pickLabel(p)));
      main.appendChild(title);

      const sub = document.createElement('div'); sub.className = 'pick-sub';
      // У выбора из витрины карты нет вовсе — иначе тут выводилось бы «Карта null».
      sub.textContent = p.workUrl
        ? 'Из витрины студии · клиент выбрал вашу работу'
        : (p.design
          ? 'Карта ' + p.card + ' · дизайн ' + p.design + ' из 5'
          : 'Карта ' + p.card + ' · конкретный дизайн не выбран');
      main.appendChild(sub);

      // По тапу — фото на весь экран. Ставим обработчик здесь, когда подписи уже
      // готовы: в лайтбоксе они нужны, чтобы мастер видел, что именно открыл.
      if (photo) {
        li.classList.add('pick-clickable');
        // Раньше здесь стояла несуществующая переменная label, и тап по выбору падал
        // с ошибкой: фото на весь экран не открывалось ни у кого.
        li.addEventListener('click', () => openPickPhoto(photo, pickLabel(p), sub.textContent));
      }

      if (card && Array.isArray(card.colors)) {
        const dots = document.createElement('div'); dots.className = 'pick-dots';
        (card.hexes || []).slice(0, 5).forEach((h) => {
          const i = document.createElement('i'); i.style.background = h; dots.appendChild(i);
        });
        if (dots.children.length) main.appendChild(dots);
      }

      const when = document.createElement('span');
      when.className = 'pick-when'; when.textContent = whenText(p.created_at);

      li.appendChild(main); li.appendChild(when);
      ul.appendChild(li);
    });
  }

  // --- Сводка: какие цвета выбирают ---------------------------------------
  // Периоды — 30 дней, 3 месяца и год; по умолчанию самый короткий, где выборы
  // есть. Раньше сводка считала только 30 дней и пряталась целиком, если за них
  // выборов не было, — так 16.09 у мастеров «пропала диаграмма»: все выборы
  // клиенток были в августе.
  const STATS_PERIODS = [30, 90, 365];
  const STATS_TOP = 6;
  let statsData = {}, statsDays = 0, statsDaysChosen = false, statsAll = false;

  async function loadStats() {
    const res = await Promise.all(STATS_PERIODS.map((d) => apiJson('/api/master/pick-stats?days=' + d)));
    statsData = {};
    STATS_PERIODS.forEach((d, i) => { if (res[i].ok) statsData[d] = res[i].body; });
    if (!statsDaysChosen) statsDays = STATS_PERIODS.find((d) => statsData[d] && statsData[d].total) || STATS_PERIODS[0];
    renderStats();
  }
  document.querySelectorAll('#statsPeriods button').forEach((b) => b.addEventListener('click', () => {
    statsDays = Number(b.dataset.days);
    statsDaysChosen = true;
    statsAll = false;
    renderStats();
  }));
  $('statsMore').addEventListener('click', () => { statsAll = !statsAll; renderStats(); });

  const plural = (n, one, few, many) => {
    const t = n % 100, u = n % 10;
    return t >= 11 && t <= 14 ? many : u === 1 ? one : u >= 2 && u <= 4 ? few : many;
  };
  const periodText = (d) => (d === 30 ? '30 дней' : d === 90 ? '3 месяца' : 'год');

  // Название оттенка словами. Квадрат цвета на телефоне от соседнего не отличить,
  // а закупают «тёмно-синий», а не #1d3557. Названия грубые, по тону и светлоте, —
  // рядом всегда стоит сам цвет.
  function shadeName(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'Оттенок';
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) {
      h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    if (l > 0.93) return 'Белый';
    if (l < 0.1 || (l < 0.15 && s < 0.35)) return 'Чёрный';   // тёмный, но насыщенный — это ещё цвет
    // Почти белые с лёгким оттенком — «молочный», а розоватые из них — «пудровый»:
    // на глаз это не «светло-зелёный», а так их и называют в каталогах лаков.
    if (l >= 0.85 && s < 0.35) return (h >= 290 || h < 12) && s >= 0.15 ? 'Пудровый' : 'Молочный';
    if (s < 0.14) return l > 0.7 ? 'Светло-серый' : l < 0.35 ? 'Графитовый' : 'Серый';
    if (h < 12 || h >= 345) {
      if (l < 0.32) return 'Бордовый';
      // Светлый «красный» на ногтях — это розовый или коралл, так его и называют.
      if (l > 0.72) return h < 12 && s > 0.6 ? 'Коралловый' : 'Светло-розовый';
      return 'Красный';
    }
    if (h < 40) {
      if (l < 0.42) return 'Коричневый';
      if (s < 0.55 && l > 0.6) return 'Бежевый';
      return l > 0.72 ? 'Персиковый' : 'Оранжевый';
    }
    if (h < 65) {
      if (s < 0.5 && l > 0.6) return 'Бежевый';
      return l < 0.35 ? 'Оливковый' : l > 0.72 ? 'Светло-жёлтый' : 'Жёлтый';
    }
    const tone = (word) => (l > 0.72 ? 'Светло-' + word : l < 0.3 ? 'Тёмно-' + word : word[0].toUpperCase() + word.slice(1));
    if (h < 160) return tone('зелёный');
    if (h < 195) return tone('бирюзовый');
    if (h < 250) return h < 215 && l > 0.55 ? tone('голубой') : tone('синий');
    if (h < 290) return s < 0.45 && l > 0.6 ? 'Лавандовый' : tone('фиолетовый');
    if (l < 0.3) return 'Сливовый';
    return s < 0.45 && l > 0.65 ? 'Пудровый' : tone('розовый');
  }

  function renderStats() {
    const data = statsData[statsDays] || { total: 0 };
    const hasAny = STATS_PERIODS.some((d) => statsData[d] && statsData[d].total);
    document.querySelectorAll('#statsPeriods button').forEach((b) => {
      const d = Number(b.dataset.days), on = d === statsDays;
      b.classList.toggle('on', on);
      b.classList.toggle('empty', !(statsData[d] && statsData[d].total));
      b.setAttribute('aria-selected', String(on));
    });
    $('statsPeriods').classList.toggle('hidden', !hasAny);

    // Один выбор — один оттенок. У карты работа №N сделана в оттенке hexes[N]
    // (это заложено в промпты всех 245 работ), поэтому выбранный дизайн даёт
    // точный цвет. Дизайн не выбран — берём первый оттенок карты, он основной.
    // Раньше на каждый выбор карты прибавлялись все пять её оттенков — сводка
    // размазывалась по палитре, и ответить «что закупать» по ней было нельзя.
    const counts = new Map();
    (data.picks || data.cards || []).forEach(({ card, design, n }) => {
      const c = cardOf(card);
      if (!c) return;
      const hexes = c.hexes || [];
      const hex = (design && hexes[design - 1]) || hexes[0];
      if (hex) counts.set(hex, (counts.get(hex) || 0) + n);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const sum = sorted.reduce((acc, [, n]) => acc + n, 0);

    const summary = $('statsSummary');
    summary.textContent = '';
    if (!hasAny) {
      summary.textContent = 'Пока пусто. Когда клиентки начнут выбирать карты по вашему QR-коду, здесь появится, '
        + 'какие цвета берут чаще, — по этой сводке удобно закупать лаки.';
    } else if (!sum) {
      summary.textContent = 'За ' + periodText(statsDays) + ' выборов не было — посмотрите период побольше.';
    } else {
      const total = data.total || sum;
      const withDesign = data.withDesign || 0;
      const strong = document.createElement('b');
      strong.textContent = total + ' ' + plural(total, 'выбор', 'выбора', 'выборов');
      summary.append('За ' + periodText(statsDays) + ': ', strong,
        ' · с конкретной работой ' + withDesign + ' (' + Math.round(withDesign / total * 100) + '%)');
    }

    // Лента долей: берём ВСЕ оттенки, а не первые, иначе доли соврут — сумма
    // отрезков должна быть равна всем выборам.
    const rib = $('statsRibbon');
    rib.innerHTML = '';
    rib.classList.toggle('hidden', sum === 0);
    sorted.forEach(([hex, n]) => {
      const seg = document.createElement('i');
      seg.style.background = hex;
      seg.style.flexGrow = String(n);
      seg.title = shadeName(hex) + ' — ' + n + ' из ' + sum + ' (' + Math.round(n / sum * 100) + '%)';
      rib.appendChild(seg);
    });

    // Рейтинг: название словами, полоса относительно лидера, число и доля.
    const list = $('statsList');
    list.innerHTML = '';
    const maxN = sorted.length ? sorted[0][1] : 1;
    (statsAll ? sorted : sorted.slice(0, STATS_TOP)).forEach(([hex, n]) => {
      const li = document.createElement('li'); li.className = 'stats-row';
      const sw = document.createElement('i'); sw.className = 'stats-swatch';
      sw.style.background = hex; sw.title = hex;
      const info = document.createElement('div');
      const name = document.createElement('div'); name.className = 'stats-name';
      name.textContent = shadeName(hex);
      const track = document.createElement('div'); track.className = 'stats-track';
      const fill = document.createElement('span');
      fill.style.width = Math.max(4, Math.round(n / maxN * 100)) + '%';
      fill.style.background = hex;
      track.appendChild(fill);
      info.append(name, track);
      const num = document.createElement('div'); num.className = 'stats-num';
      const count = document.createElement('b'); count.textContent = n;
      const pct = document.createElement('span'); pct.textContent = Math.round(n / sum * 100) + '%';
      num.append(count, pct);
      li.append(sw, info, num);
      list.appendChild(li);
    });
    const rest = sorted.length - STATS_TOP;
    $('statsMore').classList.toggle('hidden', rest <= 0);
    if (rest > 0) $('statsMore').textContent = statsAll ? 'Свернуть' : 'Все оттенки — ещё ' + rest;

    // Выборы из витрины мастера — его собственные фото, у них нет палитры колоды.
    const showcase = data.fromShowcase || 0;
    $('statsShowcase').classList.toggle('hidden', !showcase || !hasAny);
    if (showcase) {
      $('statsShowcase').textContent = 'Ещё ' + showcase + ' ' + plural(showcase, 'выбор', 'выбора', 'выборов')
        + ' — ваши работы из витрины. У них нет палитры колоды, поэтому в сводку они не входят.';
    }

    // Список карт убран намеренно: «карта 24, карта 12» для закупки бесполезно —
    // мастер покупает материал и оттенок, а не карту. Какая карта была, видно в
    // ленте выборов ниже, там же и фото по тапу.
  }
  // живое обновление, пока кабинет открыт
  function startLivePicks() {
    if (picksTimer) return;
    picksTimer = setInterval(async () => {
      if ($('dashView').classList.contains('hidden')) return;
      const r = await apiJson('/api/master/picks');
      const picks = r.body.picks || [];
      const topTs = picks.length ? picks[0].created_at : 0;
      if (topTs > lastTopTs) {
        // keepShown: если мастер раскрыл всю ленту, новый выбор не должен
        // схлопывать её обратно к десяти у него на глазах.
        renderPicks(picks, true);
        loadStats();   // новый выбор должен сразу попасть и в сводку цветов
        toast('Новый выбор: карта ' + picks[0].card);
      }
      lastTopTs = topTs;
    }, 10000);
  }

  // --- Уведомления (веб-push) ---
  const pushSupported = !native && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function urlB64ToUint8(s) {
    const pad = '='.repeat((4 - s.length % 4) % 4);
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64); const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  function setPushUI(on) {
    $('pushPill').className = 'pill ' + (on ? 'on' : 'off');
    $('pushPill').textContent = on ? 'вкл' : 'выкл';
    $('pushBtn').textContent = on ? 'Выключить уведомления' : 'Включить уведомления';
    // Проверять есть смысл только когда включено — иначе кнопка сбивает с толку.
    if ($('pushTest')) $('pushTest').classList.toggle('hidden', !on);
    // Серая плашка «выкл» рядом с заголовком ничего не сообщала о цене вопроса:
    // на 25 мастеров подписка была одна. Пишем последствие словами.
    if ($('pushOff')) $('pushOff').classList.toggle('hidden', on);
  }

  if ($('pushTest')) {
    $('pushTest').addEventListener('click', async () => {
      $('pushTest').disabled = true;
      const r = await apiJson('/api/master/push/test', { method: 'POST' });
      $('pushTest').disabled = false;
      // sent — скольким устройствам ушло. Ноль означает, что подписки на сервере
      // нет, и это надо сказать прямо, а не рисовать успех.
      if (r.ok && r.body.sent > 0) toast('Отправлено — уведомление должно прийти');
      else if (r.ok) toast('Подписки нет на сервере: выключите и включите заново');
      else toast('Не получилось проверить');
    });
  }
  async function currentSub() {
    const reg = await navigator.serviceWorker.getRegistration('/master/');
    return reg ? reg.pushManager.getSubscription() : null;
  }
  async function initPush() {
    if (!pushSupported) {
      $('pushPill').textContent = 'недоступно'; $('pushBtn').classList.add('hidden');
      // На iPhone это не «браузер не умеет», а требование Apple: PushManager
      // появляется только у кабинета, добавленного на экран «Домой». Прежний
      // текст выглядел как отказ, хотя выход есть — поэтому шаги названы прямо.
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (iOS && $('pushIos')) {
        $('pushNote').textContent = 'Уведомление приходит, когда клиент вытянул карту по вашему QR — даже если кабинет закрыт.';
        $('pushIos').classList.remove('hidden');
      } else if (inApp) {
        // Включить отсюда нельзя, но сказать, включены ли они вообще, — можно и
        // нужно. Плашка отвечает за «умеет ли это окружение», и внутри
        // приложения она всегда «недоступно»; мастер, включивший уведомления в
        // браузере, читал это как «не работают», хотя они приходили.
        const st = await apiJson('/api/master/push/status');
        if (st.ok && st.body.subs > 0) {
          $('pushPill').className = 'pill on';
          $('pushPill').textContent = 'включены';
          $('pushNote').textContent = 'Уведомления включены — приходят на устройство, '
            + 'где вы их включили. Отсюда, из приложения, их не выключить: '
            + 'откройте кабинет в браузере, если понадобится.';
          return;
        }
        // Внутри установленного приложения Push API отсутствует: Android WebView
        // его не реализует, и со стороны кабинета это не чинится.
        //
        // Прежний текст велел «открыть в Chrome», но не давал чем: адресной
        // строки в приложении нет, скопировать адрес неоткуда — тупик. Поэтому
        // адрес написан словами, чтобы мастер набрал его сам. Тот же приём, что
        // с промокодами: человеку, который не может нажать ссылку, нужен адрес,
        // а не указание нажать.
        //
        // Про «один раз» сказано не для красоты: подписка хранится на сервере и
        // привязана к браузеру, а не к тому, где открыт кабинет. Включив её в
        // браузере, мастер продолжит получать уведомления и работая в приложении.
        $('pushNote').textContent = 'Уведомления умеет только браузер — в приложении их нет. '
          + 'Чтобы включить: откройте браузер на телефоне и наберите mani-magic.ru/master. '
          + 'Включить нужно один раз, дальше они приходят и когда вы работаете в приложении.';
      } else {
        $('pushNote').textContent = 'Этот браузер не поддерживает уведомления. Откройте кабинет в Chrome или Safari.';
      }
      return;
    }
    const key = await apiJson('/api/master/push/key');
    if (!key.body.enabled) {
      $('pushPill').textContent = 'скоро'; $('pushBtn').classList.add('hidden');
      $('pushNote').textContent = 'Уведомления вот-вот подключатся на сервере.';
      return;
    }
    // Самолечение рассинхрона. Подписка живёт в браузере, а отправлять умеет
    // только сервер — и эти два состояния расходились: если запрос на сохранение
    // когда-то не дошёл, кабинет продолжал показывать «включены», а сервер о
    // подписке не знал и уведомления не уходили никому.
    // Поэтому при каждом входе переотправляем подписку из браузера на сервер:
    // запись идёт через INSERT OR REPLACE, повтор безвреден.
    const sub = await currentSub();
    if (!sub) { setPushUI(false); return; }
    const r = await api('/api/master/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub }),
    }).catch(() => null);
    const ok = !!r && r.ok;
    setPushUI(ok);
    if (!ok) $('pushNote').textContent = 'Уведомления не удалось зарегистрировать на сервере — нажмите кнопку ещё раз.';
  }
  $('pushBtn').addEventListener('click', async () => {
    $('pushBtn').disabled = true;
    try {
      const existing = await currentSub();
      if (existing) {
        await api('/api/master/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) });
        await existing.unsubscribe();
        setPushUI(false); toast('Уведомления выключены');
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toast('Разрешите уведомления в браузере'); return; }
        const reg = await navigator.serviceWorker.register('push-sw.js');
        await navigator.serviceWorker.ready;
        const key = await apiJson('/api/master/push/key');
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key.body.key) });
        // Ответ обязательно проверяем: fetch НЕ считает ошибкой 4xx/5xx, и раньше
        // кабинет писал «включены» даже когда сервер подписку не сохранил. Мастер
        // ждал уведомлений, которых никто не отправлял.
        const saved = await api('/api/master/push/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub }),
        });
        if (!saved.ok) {
          // Оставлять подписку в браузере без записи на сервере нельзя: именно из
          // этого расхождения и получалось «включено, но не приходит».
          await sub.unsubscribe().catch(() => {});
          setPushUI(false);
          toast('Сервер не сохранил подписку — попробуйте ещё раз');
          return;
        }
        setPushUI(true); toast('Уведомления включены');
      }
    } catch (e) { toast('Не получилось включить'); }
    finally { $('pushBtn').disabled = false; }
  });
  if (pushSupported) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'pick') {
        loadPicks();
        toast((e.data.data && e.data.data.body) || 'Новый выбор клиента');
      }
    });
  }

  // Передача входа из приложения.
  //
  // Токен хранится отдельно для каждого адреса. Установленное приложение живёт
  // на своём (capacitor://localhost), кабинет — на https, и localStorage у них
  // разные. Мастер, вошедший в приложении, при переходе «В кабинет» упирался во
  // второй запрос почты и ждал второе письмо. Ключ у хранилища одинаковый, и от
  // этого казалось, что всё должно работать само.
  //
  // Приложение передаёт токен в ЯКОРЕ адреса (#t=…), а не в параметре: якорь не
  // уходит на сервер и не попадает в журналы nginx — а мы эти журналы читаем.
  // Забрав токен, сразу стираем якорь из адресной строки, чтобы он не уехал
  // вместе со скопированной ссылкой.
  (function pickUpHandoff() {
    const m = (location.hash || '').match(/[#&]t=([A-Za-z0-9._-]+)/);
    if (!m) return;
    token = m[1];
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  })();

  // Системная «Назад» (кнопка Android, свайп в Safari) идёт по экранам кабинета:
  // сначала закрывает верхнее окно, потом возвращает с вкладки на «Главное» и
  // только потом уводит из кабинета. Раньше это работало лишь для окон и только
  // в приложении, где кнопку к тому же никто не передавал странице, — и «Назад»
  // закрывала приложение с любого экрана (исправлено в MainActivity, 1.9.14).
  {
    const layers = [['pickPhoto', closePickPhoto], ['sorter', closeSorter], ['album', closeAlbum], ['clientCard', closeClient]];
    const topLayer = () => layers.find(([id]) => !$(id).classList.contains('hidden'));
    let pushed = false, ownBack = false;
    function syncBack() {
      if (topLayer() && !pushed) { history.pushState({ cabinetOverlay: true }, ''); pushed = true; }
      else if (!topLayer() && pushed) { pushed = false; ownBack = true; history.back(); }
    }
    const observer = new MutationObserver(syncBack);
    layers.forEach(([id]) => observer.observe($(id), { attributes: true, attributeFilter: ['class'] }));
    window.addEventListener('popstate', () => {
      if (ownBack) { ownBack = false; return; }
      if (tabOwnBack) { tabOwnBack = false; return; }
      const layer = topLayer();
      if (layer) { pushed = false; layer[1](); syncBack(); return; }
      if (tabPushed) { tabPushed = false; showTab('main'); }
    });
  }

  // старт
  if (token) enterDash(); else show('login');
})();
