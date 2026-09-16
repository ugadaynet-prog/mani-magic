(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const deck = window.ManiDeck;
  const icons = () => window.lucide?.createIcons();
  const icon = name => `<i data-lucide="${name}"></i>`;
  const closeButton = id => `<button type="button" class="icon-button" data-close="${id}" title="Закрыть" aria-label="Закрыть">${icon('x')}</button>`;
  const native = !!window.Capacitor?.isNativePlatform?.();
  const localPreview = !native && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const navItems = [['deck', 'layers', 'Колода'], ['catalog', 'layout-grid', 'Каталог'], ['tryon', 'scan', 'Примерка'], ['favorites', 'heart', 'Избранное'], ['diary', 'book-open', 'Дневник']];
  $('experienceRoot').innerHTML = `
    <section id="diaryOverlay" class="experience-page hidden ym-hide-content" aria-label="Дневник">
      <div class="page-heading"><div><p class="eyebrow">МОЯ ИСТОРИЯ</p><h1>Дневник маникюра</h1></div><button id="newDiaryBtn" class="icon-button accent" title="Добавить маникюр" aria-label="Добавить маникюр">${icon('plus')}</button></div>
      <p class="storage-note">Фото и записи хранятся только на этом устройстве.</p><div id="diaryList" class="diary-grid"></div>
    </section>
    <section id="tryonOverlay" class="experience-page hidden" aria-label="Примерка">
      <div class="page-heading"><div><p class="eyebrow">ПЕРЕД ВИЗИТОМ</p><h1>Примерка цвета</h1></div></div>
      <img class="tryon-cover" id="tryonCover" alt="Маникюр">
      <p>Примерка на фото доступна в Android-приложении MANI Magic.</p>
      <a id="openTryonBtn" class="action-button" href="tryon/index.html">Открыть примерку</a>
    </section>
    <dialog id="diaryEditor" class="experience-dialog ym-hide-content" data-ym-disable-keys><form id="diaryForm">
      <div class="dialog-heading"><h2 id="diaryEditorTitle">Новый маникюр</h2>${closeButton('diaryEditor')}</div>
      <label class="photo-picker"><img id="diaryPhotoPreview" class="hidden" alt="Фото маникюра"><span id="diaryPhotoLabel">${icon('image-plus')}Добавить фото</span><input id="diaryPhoto" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"></label>
      <div class="form-row"><label>Дата<input id="diaryDate" type="date" required></label><label>Цвет<input id="diaryColor" maxlength="60" placeholder="Малиновый"></label></div>
      <label>Карта и цвет<select id="diaryCard"><option value="">Без карты</option></select>
        <span id="diaryCardChoice" class="diary-card-choice hidden"><img id="diaryCardPreview" alt="Предпросмотр выбранной карты"><span><b id="diaryCardName"></b><small id="diaryCardPhrase"></small></span></span>
      </label>
      <label id="diaryDesignLabel" class="hidden">Дизайн<select id="diaryDesign"><option value="">Вся карта</option></select></label>
      <label>Заметка<textarea id="diaryNote" rows="3" maxlength="1000" placeholder="Что понравилось, какой оттенок повторить"></textarea></label>
      <label class="check-row"><input id="diaryRepeat" type="checkbox">Хочу повторить</label>
      <p id="diaryError" class="form-error" role="status"></p><button id="diarySave" type="submit" class="action-button">Сохранить в дневник</button>
    </form></dialog>
    <dialog id="resultDialog" class="experience-dialog ym-hide-content"><div class="dialog-heading"><h2>Карта и мой результат</h2>${closeButton('resultDialog')}</div>
      <img id="resultPreview" class="result-preview" alt="Карта и готовый маникюр">
      <div class="dialog-actions"><button id="resultDownload" class="action-button">${icon('download')}Сохранить</button><button id="resultShare" class="action-button secondary">${icon('share-2')}Поделиться</button></div><p id="resultStatus" role="status" class="storage-note"></p>
    </dialog>
    <dialog id="pollDialog" class="experience-dialog"><div class="dialog-heading"><h2>Помоги выбрать</h2>${closeButton('pollDialog')}</div>
      <p id="pollStatus" role="status"></p><div id="pollChoices" class="poll-grid"></div><button id="pollCreate" class="action-button">Создать голосование</button>
      <div id="pollLinkRow" class="hidden"><label>Ссылка для подруги<input id="pollLink" readonly></label><button id="pollShare" class="action-button">${icon('send')}Отправить подруге</button></div>
      <div class="dialog-actions"><button id="pollRefresh" class="action-button secondary hidden">${icon('refresh-cw')}Обновить</button><button id="pollCloseVoting" class="action-button secondary hidden">Завершить голосование</button></div>
    </dialog>
    <nav class="bottom-nav" aria-label="Основные разделы">${navItems.map(([page, glyph, text]) => `<button data-page="${page}">${icon(glyph)}<span>${text}</span></button>`).join('')}</nav>`;

  const heading = document.createElement('div');
  heading.className = 'deck-heading';
  heading.innerHTML = '<div><p class="eyebrow">АТЕЛЬЕ ЦВЕТА</p><h1>Какой цвет сегодня?</h1></div>';
  document.querySelector('.brand-mark')?.remove();
  document.querySelector('.brand-header').append(heading);
  const meta = document.createElement('div');
  meta.className = 'deck-meta';
  meta.innerHTML = '<span id="cardCaption"></span>';
  meta.append($('histNav'));
  document.querySelector('.controls').prepend(meta);
  const resultButton = document.createElement('button');
  resultButton.id = 'addResultBtn';
  resultButton.className = 'btn';
  resultButton.innerHTML = icon('camera') + 'Мой маникюр';
  document.querySelector('.foot-row').append(resultButton);
  const settings = document.createElement('div');
  settings.className = 'settings-tools';
  // «Карта дня» остаётся в верхней панели; в «Ещё» складываем только настройки.
  settings.append($('soundBtn'), $('themeBtn'), $('notifyBtn'));
  document.querySelector('.more-title').after(settings);
  settings.after($('permBtn'));
  const catalogTools = document.createElement('div');
  catalogTools.className = 'catalog-tools';
  catalogTools.append($('filterBtn'), $('fitBtn'));
  $('catalogFitTools')?.remove();
  $('catalogTitle').after(catalogTools);
  const pollHistory = document.createElement('section');
  pollHistory.className = 'poll-history';
  $('favOverlay').append(pollHistory);
  $('tryonCover').src = deck.cards[0].works[0];
  if (!native && !localPreview) $('openTryonBtn').classList.add('hidden');
  [$('soundBtn'), $('themeBtn'), $('notifyBtn'), $('moreBtn'), $('qrBtn'), $('dayBtn')].forEach(button => button.title = button.getAttribute('aria-label'));

  const pages = { catalog: 'catalogOverlay', favorites: 'favOverlay', diary: 'diaryOverlay', tryon: 'tryonOverlay' };
  ['diaryOverlay', 'tryonOverlay', 'diaryEditor', 'resultDialog', 'pollDialog', 'fitOverlay'].forEach(id => deck.registerOverlay(id));
  let currentPage = 'deck';
  function markPage(page) {
    currentPage = page;
    document.querySelector('.app').inert = page !== 'deck';
    document.querySelector('.app').style.visibility = page === 'deck' ? '' : 'hidden';
    document.querySelectorAll('[data-page]').forEach(button => {
      if (button.dataset.page === page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  function navigate(page) {
    if (page === 'tryon' && (native || localPreview)) {
      location.href = 'tryon/index.html';
      return;
    }
    Object.values(pages).forEach(id => $(id).classList.add('hidden'));
    ['paywallClose', 'filterClose', 'qrClose', 'selClose', 'moreClose'].forEach(id => {
      const button = $(id);
      const overlay = button?.closest('.fav-overlay, .more-sheet');
      if (overlay && !overlay.classList.contains('hidden')) button.click();
    });
    $('filterOverlay').classList.add('hidden');
    $('fitOverlay')?.classList.add('hidden');
    if (page === 'catalog') $('catalogBtn').click();
    if (page === 'favorites') { $('favBtn').click(); renderPollHistory(); }
    if (page === 'diary') { $('diaryOverlay').classList.remove('hidden'); renderDiary(); }
    if (page === 'tryon') $('tryonOverlay').classList.remove('hidden');
    markPage(page);
  }
  document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => navigate(button.dataset.page));
  const pageObserver = new MutationObserver(() => {
    const visible = Object.entries(pages).find(([, id]) => !$(id).classList.contains('hidden'));
    markPage(visible?.[0] || 'deck');
  });
  Object.values(pages).forEach(id => pageObserver.observe($(id), { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]')) navigate('deck');
  });
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
  const caption = () => {
    const index = deck.currentIndex;
    const daily = !$('dayBadge').classList.contains('hidden');
    $('cardCaption').textContent = index < 0 ? '' : `${daily ? 'Карта дня' : 'Карта'} · ${String(index + 1).padStart(2, '0')} / ${deck.cards.length}`;
  };
  window.addEventListener('mani:card', caption);
  new MutationObserver(caption).observe($('dayBadge'), { attributes: true, attributeFilter: ['class'] });
  caption(); markPage('deck'); icons();

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function tool(name, label, action) {
    const button = element('button', 'icon-button');
    button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
    button.innerHTML = icon(name); button.onclick = action;
    return button;
  }
  function today() {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  const formatDate = value => new Date(value + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  deck.cards.forEach((card, index) => {
    const colors = (card.colors || []).join(' / ') || 'цвет не указан';
    $('diaryCard').append(new Option(`Карта №${String(index + 1).padStart(2, '0')} · ${colors}`, index));
  });
  function updateDiaryCardChoice(preferredDesign = '') {
    const value = $('diaryCard').value;
    const choice = $('diaryCardChoice');
    const designLabel = $('diaryDesignLabel');
    if (value === '') { choice.classList.add('hidden'); designLabel.classList.add('hidden'); return; }
    const index = Number(value), card = deck.cards[index];
    if (!card) { choice.classList.add('hidden'); designLabel.classList.add('hidden'); return; }
    const works = Array.isArray(card.works) ? card.works : [];
    const labels = Array.isArray(card.workLabels) ? card.workLabels : [];
    const design = preferredDesign === '' ? '' : Number(preferredDesign);
    const designSelect = $('diaryDesign');
    designSelect.replaceChildren(new Option('Вся карта', ''));
    works.forEach((_, i) => designSelect.append(new Option(`Дизайн ${i + 1}${labels[i] ? ' · ' + labels[i] : ''}`, i + 1)));
    designSelect.value = design > 0 && design <= works.length ? String(design) : '';
    designLabel.classList.toggle('hidden', works.length === 0);
    designSelect.disabled = works.length === 0;
    const selectedDesign = Number(designSelect.value) || 0;
    const image = selectedDesign ? works[selectedDesign - 1] : card.front;
    $('diaryCardPreview').src = image;
    $('diaryCardName').textContent = `Карта №${String(index + 1).padStart(2, '0')} · ${(card.colors || []).join(' / ') || 'цвет не указан'}${selectedDesign ? ` · Дизайн ${selectedDesign}` : ''}`;
    $('diaryCardPhrase').textContent = card.phrase || '';
    choice.classList.remove('hidden');
  }
  $('diaryCard').addEventListener('change', updateDiaryCardChoice);
  $('diaryDesign').addEventListener('change', () => updateDiaryCardChoice($('diaryDesign').value));
  let editing = null, photo = null, photoUrl = null, photoSequence = 0;
  let entryUrls = [], diarySequence = 0;
  function showPhoto(blob) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = blob ? URL.createObjectURL(blob) : null;
    $('diaryPhotoPreview').classList.toggle('hidden', !blob);
    $('diaryPhotoLabel').classList.toggle('hidden', !!blob);
    if (blob) $('diaryPhotoPreview').src = photoUrl;
    else $('diaryPhotoPreview').removeAttribute('src');
  }
  function editDiary(entry = null, card = null, design = null) {
    editing = entry;
    photoSequence++;
    photo = entry?.photo || null;
    $('diaryForm').reset();
    $('diaryDate').value = entry?.date || today();
    $('diaryDate').max = today();
    $('diaryColor').value = entry?.color || (card !== null ? deck.cards[card]?.colors?.[0] || '' : '');
    $('diaryCard').value = entry?.card ?? card ?? '';
    updateDiaryCardChoice(entry?.design ?? design ?? '');
    $('diaryNote').value = entry?.note || '';
    $('diaryRepeat').checked = !!entry?.repeat;
    $('diaryError').textContent = '';
    $('diarySave').disabled = false;
    $('diaryEditorTitle').textContent = entry ? 'Мой маникюр' : 'Новый маникюр';
    showPhoto(photo); $('diaryEditor').showModal();
  }
  $('newDiaryBtn').onclick = () => editDiary();
  resultButton.onclick = () => editDiary(null, deck.currentIndex >= 0 ? deck.currentIndex : null);
  // Избранное вызывает эту точку входа с номером карты и, если сохранена
  // отдельная работа, с номером дизайна. Так клиентка не ищет карту повторно.
  window.ManiDiary = { open(card = null, design = null) { navigate('diary'); editDiary(null, card, design); } };
  $('diaryPhoto').onchange = async () => {
    const file = $('diaryPhoto').files[0];
    if (!file) return;
    const sequence = ++photoSequence;
    $('diarySave').disabled = true;
    $('diaryError').textContent = '';
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Фото слишком большое. Максимум 20 МБ.');
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
      if (!compressed) throw new Error('Не удалось обработать фото.');
      if (sequence !== photoSequence) return;
      photo = compressed; showPhoto(photo);
    } catch (error) {
      if (sequence === photoSequence) $('diaryError').textContent = error.message.includes('20 МБ') ? error.message : 'Не удалось открыть фото. Попробуйте JPEG или PNG.';
    } finally { if (sequence === photoSequence) $('diarySave').disabled = false; }
  };
  $('diaryForm').onsubmit = async event => {
    event.preventDefault();
    if (!photo) { $('diaryError').textContent = 'Добавьте фото маникюра.'; return; }
    $('diarySave').disabled = true;
    try {
      const card = $('diaryCard').value === '' ? null : Number($('diaryCard').value);
      const design = card === null || $('diaryDesign').value === '' ? null : Number($('diaryDesign').value);
      const entry = { id: editing?.id || crypto.randomUUID(), createdAt: editing?.createdAt || Date.now(), date: $('diaryDate').value, color: $('diaryColor').value.trim(), card, design, note: $('diaryNote').value.trim(), repeat: $('diaryRepeat').checked, photo };
      await window.ManiDiaryStore.save(entry);
      $('diaryEditor').close(); navigate('diary');
      deck.notify('Сохранено в дневник');
    } catch { $('diaryError').textContent = 'Не удалось сохранить. Проверьте свободное место на устройстве.'; }
    finally { $('diarySave').disabled = false; }
  };
  async function renderDiary() {
    const sequence = ++diarySequence;
    const list = $('diaryList');
    try {
      const entries = await window.ManiDiaryStore.all();
      if (sequence !== diarySequence) return;
      entryUrls.forEach(url => URL.revokeObjectURL(url)); entryUrls = [];
      list.replaceChildren();
      entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      if (!entries.length) {
        const empty = element('div', 'empty-state');
        const image = element('img'); image.src = deck.cards[0].works[0]; image.alt = 'Маникюр';
        const add = element('button', 'action-button', 'Добавить первый маникюр'); add.onclick = () => editDiary();
        empty.append(image, element('h2', '', 'Мои маленькие истории цвета'), add); list.append(empty);
      }
      entries.forEach(entry => {
        const article = element('article', 'diary-entry');
        const img = element('img');
        const url = URL.createObjectURL(entry.photo); entryUrls.push(url);
        img.src = url; img.alt = entry.color || 'Мой маникюр'; img.loading = 'lazy';
        article.append(img, element('h2', '', entry.color || 'Мой маникюр'));
        const date = element('time', '', formatDate(entry.date)); date.dateTime = entry.date; article.append(date);
        if (entry.repeat) article.append(element('p', '', 'Хочу повторить'));
        if (entry.note) article.append(element('p', '', entry.note));
        const actions = element('div', 'entry-actions');
        actions.append(tool('pencil', 'Редактировать маникюр', () => editDiary(entry)));
        if (entry.card !== null && deck.cards[entry.card]) actions.append(tool('layers', `Открыть карту №${String(entry.card + 1).padStart(2, '0')}${entry.design ? ` · дизайн ${entry.design}` : ''}`, () => { navigate('deck'); deck.openCard(entry.card); }));
        actions.append(tool('image', 'Карта и результат', () => composeResult(entry)));
        actions.append(tool('trash-2', 'Удалить маникюр', async () => {
          if (!window.confirm('Удалить эту запись и фото из дневника?')) return;
          try { await window.ManiDiaryStore.remove(entry.id); await renderDiary(); }
          catch { deck.notify('Не удалось удалить запись'); }
        }));
        article.append(actions); list.append(article);
      });
      icons();
    } catch { list.replaceChildren(element('p', 'form-error', 'Дневник недоступен. Разрешите хранение данных в браузере и попробуйте снова.')); }
  }

  let resultBlob = null, resultUrl = null;
  async function loadImage(src) {
    const img = new Image(); img.src = src; await img.decode(); return img;
  }
  function contain(context, image, x, y, w, h) {
    const scale = Math.min(w / image.width, h / image.height);
    const width = image.width * scale, height = image.height * scale;
    context.drawImage(image, x + (w - width) / 2, y + (h - height) / 2, width, height);
  }
  async function composeResult(entry) {
    $('resultStatus').textContent = 'Готовим изображение…';
    $('resultPreview').removeAttribute('src');
    $('resultShare').disabled = $('resultDownload').disabled = true;
    $('resultDialog').showModal();
    try {
      const photoBitmap = await createImageBitmap(entry.photo);
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
      const context = canvas.getContext('2d');
      context.fillStyle = '#18191c'; context.fillRect(0, 0, 1080, 1350);
      context.fillStyle = '#f5f4f3'; context.font = '52px Georgia'; context.fillText('MANI Magic', 64, 100);
      context.fillStyle = '#e95880'; context.font = '26px sans-serif'; context.fillText('МОЯ ИСТОРИЯ ЦВЕТА', 64, 154);
      if (entry.card !== null && deck.cards[entry.card]) {
        const card = deck.cards[entry.card];
        const design = Number(entry.design) || 0;
        const source = design > 0 && card.works?.[design - 1] ? card.works[design - 1] : card.front;
        const image = await loadImage(source);
        contain(context, image, 64, 220, 340, 800);
        contain(context, photoBitmap, 444, 220, 572, 800);
        context.fillStyle = '#aeacb1'; context.font = '24px sans-serif';
        context.fillText(`Карта №${String(entry.card + 1).padStart(2, '0')}${design ? ` · дизайн ${design}` : ''}`, 64, 1070); context.fillText('Мой маникюр', 444, 1070);
      } else { contain(context, photoBitmap, 64, 220, 952, 860); }
      photoBitmap.close();
      context.fillStyle = '#f5f4f3';
      let size = 44; const title = entry.color || 'Мой маникюр';
      do { context.font = `${size}px sans-serif`; size--; } while (context.measureText(title).width > 952 && size > 14);
      context.fillText(title, 64, 1170);
      context.fillStyle = '#aeacb1'; context.font = '26px sans-serif'; context.fillText(formatDate(entry.date), 64, 1224);
      context.fillStyle = '#d73562'; context.fillRect(64, 1278, 952, 3);
      resultBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .93));
      if (!resultBlob) throw new Error('image_failed');
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(resultBlob); $('resultPreview').src = resultUrl;
      $('resultStatus').textContent = ''; $('resultShare').disabled = $('resultDownload').disabled = false;
    } catch { $('resultStatus').textContent = 'Не удалось подготовить изображение. Попробуйте ещё раз.'; }
  }
  const dataUrl = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  async function saveResult(share) {
    if (!resultBlob) return;
    try {
      const plugins = window.Capacitor?.Plugins;
      const name = 'MANI-Magic-' + Date.now() + '.jpg';
      if (native && plugins) {
        const encoded = await dataUrl(resultBlob);
        if (share && plugins.Share && plugins.Filesystem) {
          const { uri } = await plugins.Filesystem.writeFile({ path: name, data: encoded.split(',')[1], directory: 'CACHE' });
          await plugins.Share.share({ title: 'Мой маникюр', files: [uri] }); return;
        }
        const media = plugins.TryOnMedia || window.Capacitor.registerPlugin?.('TryOnMedia');
        if (!share && media) { await media.saveImage({ data: encoded, name }); $('resultStatus').textContent = 'Сохранено в галерею'; return; }
      }
      const file = new File([resultBlob], name, { type: 'image/jpeg' });
      if (share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Мой маникюр · MANI Magic' }); return; }
      const link = document.createElement('a'); link.href = resultUrl; link.download = name; link.click();
      $('resultStatus').textContent = share ? 'Изображение сохранено в загрузки. Его можно отправить подруге.' : 'Изображение сохранено в загрузки';
    } catch (error) { if (error.name !== 'AbortError') $('resultStatus').textContent = 'Не удалось сохранить или отправить изображение.'; }
  }
  $('resultDownload').onclick = () => saveResult(false); $('resultShare').onclick = () => saveResult(true);

  const POLLS_KEY = 'maniMagicPolls';
  const readPolls = () => { try { const data = JSON.parse(localStorage.getItem(POLLS_KEY) || '[]'); return Array.isArray(data) ? data.filter(p => typeof p.id === 'string' && typeof p.ownerToken === 'string') : []; } catch { return []; } };
  let selected = [], activePoll = null, pendingDraft = null, pollSequence = 0;
  const optionRef = favorite => typeof favorite === 'number' ? { card: favorite + 1, design: null } : { card: favorite.c + 1, design: favorite.d };
  const optionKey = option => option.card + ':' + (option.design || 0);
  const voteCount = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'голос' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'голоса' : 'голосов'}`;
  const optionImage = option => option.design ? deck.cards[option.card - 1]?.works[option.design - 1] : deck.cards[option.card - 1]?.front;
  const optionLabel = option => option.design ? deck.cards[option.card - 1]?.workLabels?.[option.design - 1] || `Карта ${option.card}, дизайн ${option.design}` : `Карта ${option.card}`;
  async function api(path, body, ownerToken) {
    const response = await fetch(deck.apiUrl + '/api/polls' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(ownerToken ? { Authorization: 'Bearer ' + ownerToken } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const messages = { 404: 'Голосование не найдено.', 410: 'Голосование завершено.', 429: 'Слишком много запросов. Попробуйте чуть позже.' };
      throw new Error(messages[response.status] || 'Не удалось связаться с голосованием. Попробуйте снова.');
    }
    return response.json();
  }
  function resetPoll() {
    pollSequence++;
    activePoll = null;
    $('pollChoices').replaceChildren(); $('pollCreate').classList.add('hidden');
    ['pollLinkRow', 'pollRefresh', 'pollCloseVoting'].forEach(id => $(id).classList.add('hidden'));
    $('pollStatus').textContent = '';
    if (!$('pollDialog').open) $('pollDialog').showModal();
  }
  function choose() {
    resetPoll(); selected = []; pendingDraft = null;
    const options = deck.favorites.map(optionRef);
    if (options.length < 2) { $('pollStatus').textContent = 'Для голосования нужны хотя бы два цвета или дизайна в избранном.'; return; }
    $('pollStatus').textContent = 'Выберите 2–3 варианта'; $('pollCreate').classList.remove('hidden'); $('pollCreate').disabled = true;
    options.forEach(option => {
      const choice = element('label', 'poll-choice');
      const image = element('img'); image.src = optionImage(option); image.alt = optionLabel(option);
      const check = element('input'); check.type = 'checkbox'; check.setAttribute('aria-label', optionLabel(option));
      check.onchange = () => {
        if (check.checked && selected.length >= 3) { check.checked = false; $('pollStatus').textContent = 'Можно выбрать не больше трёх вариантов'; return; }
        selected = check.checked ? [...selected, option] : selected.filter(o => optionKey(o) !== optionKey(option));
        pendingDraft = null;
        choice.classList.toggle('selected', check.checked);
        $('pollStatus').textContent = `Выбрано ${selected.length} из 3`;
        $('pollCreate').disabled = selected.length < 2;
      };
      choice.append(image, check, element('span', '', optionLabel(option))); $('pollChoices').append(choice);
    });
  }
  $('pollCreate').onclick = async () => {
    $('pollCreate').disabled = true;
    const sequence = pollSequence;
    try {
      // Persist the recovery secret before the request; retries use the same id.
      const draft = pendingDraft || { id: crypto.randomUUID(), ownerToken: crypto.randomUUID(), createdAt: Date.now(), options: selected.slice(), pending: true };
      const history = readPolls();
      if (!history.some(p => p.id === draft.id)) history.unshift(draft);
      localStorage.setItem(POLLS_KEY, JSON.stringify(history));
      pendingDraft = draft;
      const poll = await api('', draft);
      draft.pending = false;
      localStorage.setItem(POLLS_KEY, JSON.stringify(readPolls().map(p => p.id === draft.id ? draft : p)));
      if (sequence !== pollSequence) return;
      showPoll(poll, draft); renderPollHistory();
    } catch (error) { if (sequence === pollSequence) $('pollStatus').textContent = error.message || 'Не удалось создать голосование.'; }
    finally { $('pollCreate').disabled = false; }
  };
  function publicLink(id) {
    const url = new URL(deck.shareLink('?poll=' + encodeURIComponent(id)));
    if (localPreview) { url.protocol = location.protocol; url.host = location.host; }
    return url.href;
  }
  function voterId(id) {
    const key = 'maniMagicVote:' + id;
    let voter = localStorage.getItem(key);
    if (!voter) { voter = crypto.randomUUID(); localStorage.setItem(key, voter); }
    return voter;
  }
  function showPoll(poll, owner) {
    activePoll = { ...poll, owner };
    $('pollCreate').classList.add('hidden'); $('pollChoices').replaceChildren();
    const total = poll.votes.reduce((sum, n) => sum + n, 0);
    $('pollStatus').textContent = poll.closed ? `Голосование завершено · голосов: ${total}` : owner ? `Голосов: ${total}` : 'Подруга просит помочь выбрать цвет';
    let myChoice = null;
    try { myChoice = localStorage.getItem('maniMagicChoice:' + poll.id); } catch {}
    poll.options.forEach((option, index) => {
      const choice = element('button', 'poll-choice' + (myChoice === String(index) ? ' selected' : ''));
      const img = element('img'); img.src = optionImage(option); img.alt = optionLabel(option);
      choice.append(img, element('span', '', optionLabel(option)), element('span', '', `${voteCount(poll.votes[index])}${myChoice === String(index) ? ' · Ваш выбор' : ''}`));
      if (!owner && !poll.closed) choice.append(element('span', '', 'Я за этот'));
      choice.disabled = !!owner || poll.closed;
      choice.onclick = async () => {
        const sequence = pollSequence;
        $('pollChoices').querySelectorAll('button').forEach(b => b.disabled = true);
        try {
          const updated = await api('/' + poll.id + '/vote', { voter: voterId(poll.id), option: index });
          try { localStorage.setItem('maniMagicChoice:' + poll.id, index); } catch {}
          if (sequence !== pollSequence) return;
          showPoll(updated, owner); $('pollStatus').textContent = 'Голос сохранён. Подруга увидит ваш выбор.';
        } catch (error) { if (sequence === pollSequence) { showPoll(poll, owner); $('pollStatus').textContent = error.message; } }
      };
      $('pollChoices').append(choice);
    });
    $('pollRefresh').classList.remove('hidden');
    $('pollLinkRow').classList.toggle('hidden', !owner);
    $('pollCloseVoting').classList.toggle('hidden', !owner || poll.closed);
    $('pollLink').value = publicLink(poll.id);
  }
  async function openPoll(id) {
    resetPoll(); const sequence = pollSequence;
    $('pollStatus').textContent = 'Загружаем голосование…';
    const owner = readPolls().find(p => p.id === id);
    try {
      // A draft may have been saved just before the connection dropped.
      const poll = owner?.pending ? await api('', owner) : await api('/' + encodeURIComponent(id));
      if (owner?.pending) {
        owner.pending = false;
        localStorage.setItem(POLLS_KEY, JSON.stringify(readPolls().map(p => p.id === id ? owner : p)));
      }
      if (sequence === pollSequence) showPoll(poll, owner);
    } catch (error) { if (sequence === pollSequence) { $('pollStatus').textContent = error.message; $('pollRefresh').classList.remove('hidden'); activePoll = { id, owner }; } }
  }
  $('pollRefresh').onclick = () => activePoll && openPoll(activePoll.id);
  $('pollCloseVoting').onclick = async () => {
    const current = activePoll;
    if (!current?.owner || !confirm('Завершить голосование? Новые голоса больше не будут приниматься.')) return;
    try { const poll = await api('/' + current.id + '/close', {}, current.owner.ownerToken); showPoll(poll, current.owner); }
    catch (error) { $('pollStatus').textContent = error.message; }
  };
  $('pollShare').onclick = async () => {
    const url = $('pollLink').value;
    const payload = { title: 'Помоги выбрать · MANI Magic', text: 'Подруга, помоги выбрать цвет!', url };
    try {
      if (native && window.Capacitor?.Plugins?.Share) await window.Capacitor.Plugins.Share.share(payload);
      else if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(url); $('pollStatus').textContent = 'Ссылка скопирована'; }
    } catch (error) { if (error.name !== 'AbortError') { $('pollLink').select(); $('pollStatus').textContent = 'Ссылка для отправки выделена'; } }
  };
  function renderPollHistory() {
    const polls = readPolls(); pollHistory.replaceChildren();
    if (!polls.length) return;
    pollHistory.append(element('h2', '', 'Мои голосования'));
    polls.forEach(poll => {
      const row = element('div', 'poll-row');
      const open = element('button', '', 'Помоги выбрать · ' + new Date(poll.createdAt).toLocaleDateString('ru-RU')); open.onclick = () => openPoll(poll.id);
      row.append(open, tool('arrow-up-right', 'Открыть голосование', () => openPoll(poll.id))); pollHistory.append(row);
    }); icons();
  }
  $('pollDialog').addEventListener('close', () => pollSequence++);
  window.ManiExperience = { choose, navigate };
  const incomingPoll = new URLSearchParams(location.search).get('poll');
  const incomingView = new URLSearchParams(location.search).get('view');
  if (['catalog', 'favorites', 'diary'].includes(incomingView)) navigate(incomingView);
  if (incomingPoll) openPoll(incomingPoll);
})();
