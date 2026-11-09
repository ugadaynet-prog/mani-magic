'use strict';
(() => {
  const finishes = { glossy: 'глянцевый', matte: 'матовый', jelly: 'желе', sheer: 'полупрозрачный' };
  let opening;
  function database() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open('maniMagicTryonFavorites', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function run(mode, operation) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const request = operation(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || Error('storage_failed'));
    });
  }

  function save(photo, color, finish) {
    return run('readwrite', photos => photos.add({
      id: crypto.randomUUID(), photo, color: color.toUpperCase(), finish, time: Date.now(),
    }));
  }
  window.ManiTryonFavorites = { save };

  const section = document.getElementById('favTryons');
  if (!section) return;
  const grid = document.getElementById('favTryonGrid');
  const dialog = document.getElementById('favTryonPreview');
  const picture = dialog.querySelector('img');
  const title = dialog.querySelector('p');
  let urls = [], previewUrl = '', revision = 0;

  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    picture.removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  });

  window.ManiTryonFavorites.render = async function render(hasCards) {
    const current = ++revision;
    let photos;
    try { photos = await run('readonly', store => store.getAll()); }
    catch { return; }
    if (current !== revision) return;
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
    grid.replaceChildren();
    section.classList.toggle('hidden', !photos.length);
    document.getElementById('favEmpty').classList.toggle('hidden', hasCards || photos.length > 0);
    for (const photo of photos.sort((a, b) => b.time - a.time)) {
      const label = photo.color + ' · ' + finishes[photo.finish];
      const item = document.createElement('div');
      item.className = 'fav-item fav-tryon';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'fav-tryon-open';
      open.setAttribute('aria-label', 'Открыть примерку: ' + label);
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = URL.createObjectURL(photo.photo);
      urls.push(img.src);
      const caption = document.createElement('span');
      caption.textContent = label;
      open.append(img, caption);
      open.addEventListener('click', () => {
        if (dialog.open) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(photo.photo);
        picture.src = previewUrl;
        title.textContent = label;
        dialog.showModal();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'fav-remove';
      remove.setAttribute('aria-label', 'Убрать примерку из избранного');
      remove.textContent = '×';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await run('readwrite', store => store.delete(photo.id));
          await render(document.getElementById('favGrid').children.length > 0);
        } catch {
          remove.disabled = false;
          document.getElementById('favTryonStatus').textContent = 'Не удалось удалить примерку.';
        }
      });
      item.append(open, remove);
      grid.appendChild(item);
    }
  };
})();
