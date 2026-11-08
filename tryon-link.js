'use strict';
(() => {
  const publicApp = 'https://mani-magic.ru/app/';
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

  const share = document.getElementById('shareShadeBtn');
  if (!share) return;
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

  const fallback = $('shadeLinkFallback');
  const linkField = $('shadeLinkValue');
  const status = $('shadeLinkStatus');
  function resetShareFeedback() {
    fallback.classList.add('hidden');
    status.textContent = '';
    if (incoming.color) $('incomingShade').classList.toggle('hidden', colorInput.value !== incoming.color);
  }
  colorInput.addEventListener('input', resetShareFeedback);
  $('palette').addEventListener('click', resetShareFeedback);
  $('finishPicker')?.addEventListener('click', resetShareFeedback);
  function showFallback(url) {
    fallback.classList.remove('hidden');
    linkField.value = url;
    linkField.focus();
    linkField.select();
  }

  share.addEventListener('click', async () => {
    const coating = document.querySelector('button[data-finish][aria-pressed="true"]')?.dataset.finish;
    // Ссылка содержит только оттенок и финиш, поэтому её можно переслать отдельно от фото и витрины.
    const route = href(colorInput.value, { finish: coating });
    if (!route) return;
    const native = window.Capacitor?.isNativePlatform?.();
    const localPreview = !native && location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname);
    const base = localPreview ? new URL('../', location.href) : publicApp;
    const url = new URL(route, base).href;
    const title = 'MANI Magic', text = 'Примерь этот оттенок на своём фото';
    resetShareFeedback();
    share.disabled = true;
    try {
      const nativeShare = native && window.Capacitor?.Plugins?.Share;
      if (nativeShare?.share) { await nativeShare.share({ title, text, url }); return; }
      if (navigator.share && (!navigator.canShare || navigator.canShare({ url }))) {
        await navigator.share({ title, text, url });
        return;
      }
      if (!navigator.clipboard?.writeText) { showFallback(url); return; }
      await navigator.clipboard.writeText(url);
      status.textContent = 'Ссылка скопирована';
    } catch (error) {
      if (error.name !== 'AbortError') showFallback(url);
    } finally {
      share.disabled = false;
    }
  });
})();
