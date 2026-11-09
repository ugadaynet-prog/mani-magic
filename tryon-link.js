'use strict';
(() => {
  const finishes = ['glossy', 'matte', 'jelly', 'sheer'];
  const hex = value => typeof value === 'string' && /^#?[\da-f]{6}$/i.test(value)
    ? '#' + value.replace(/^#/, '').toLowerCase() : '';
  const slug = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value) ? value : '';
  const finish = value => finishes.includes(value) ? value : '';

  function href(color, options = {}) {
    const shade = hex(color);
    if (!shade) return '';
    const params = new URLSearchParams({ color: shade.slice(1) });
    const coating = finish(options.finish), master = slug(options.master);
    if (coating && coating !== 'glossy') params.set('finish', coating);
    if (master) params.set('master', master);
    return 'tryon/index.html?' + params;
  }

  function read(search) {
    const params = new URLSearchParams(search);
    return { color: hex(params.get('color')), finish: finish(params.get('finish')) || 'glossy', master: slug(params.get('master')) };
  }

  window.ManiTryonLink = Object.freeze({ href, read });

  const showMaster = document.getElementById('showMasterBtn') || document.getElementById('shareShadeBtn');
  if (!showMaster) return;
  showMaster.textContent = 'Показать мастеру';
  const $ = id => document.getElementById(id);
  const colorInput = $('colorInput');
  const incoming = read(location.search);
  if (incoming.master) document.querySelector('.topbar .back').href = '../index.html?master=' + encodeURIComponent(incoming.master);
  if (incoming.color) {
    // Тот же обработчик, что у «Свой цвет»: название и активный чип не расходятся с канвасом.
    colorInput.value = incoming.color;
    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    if ($('colorCode').textContent === 'Свой цвет') $('colorCode').textContent = 'Цвет из ссылки';
    const finishButton = document.querySelector(`button[data-finish="${incoming.finish}"]`);
    finishButton?.click();
    const badge = $('incomingShade');
    badge.querySelector('span').style.backgroundColor = incoming.color;
    badge.querySelector('b').textContent = incoming.color.toUpperCase();
    badge.classList.remove('hidden');
  }

  const status = $('shadeLinkStatus');
  function resetFeedback() {
    status.textContent = '';
    if (incoming.color) $('incomingShade').classList.toggle('hidden', colorInput.value !== incoming.color);
  }
  colorInput.addEventListener('input', resetFeedback);
  $('palette').addEventListener('click', resetFeedback);
  $('finishPicker')?.addEventListener('click', resetFeedback);

  showMaster.addEventListener('click', async () => {
    let master = incoming.master;
    try { master ||= slug(localStorage.getItem('maniMasterSlug')); } catch (e) {}
    if (!master) {
      status.textContent = 'Откройте приложение по ссылке или QR-коду мастера, чтобы отправить выбор.';
      return;
    }
    const color = hex(colorInput.value);
    const coating = finish(document.querySelector('button[data-finish][aria-pressed="true"]')?.dataset.finish) || 'glossy';
    if (!color) return;
    const native = window.Capacitor?.isNativePlatform?.();
    const localPreview = !native && location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname);
    const api = localPreview ? location.origin : 'https://api.mani-magic.ru';
    showMaster.disabled = true;
    status.textContent = 'Отправляем оттенок и финиш…';
    try {
      const response = await fetch(api + '/api/m/' + encodeURIComponent(master) + '/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tryon: { color, finish: coating } }),
      });
      if (!response.ok || !(await response.json()).ok) throw Error('pick_failed');
      status.textContent = 'Мастер получит оттенок и финиш. Фото не отправлено.';
    } catch {
      status.textContent = 'Не удалось отправить выбор. Проверьте связь и попробуйте ещё раз.';
    } finally {
      showMaster.disabled = false;
    }
  });
})();
