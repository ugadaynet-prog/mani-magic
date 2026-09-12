(() => {
  let opening;
  function database() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open('maniMagicDiary', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { opening = null; reject(request.error); };
    });
    return opening;
  }
  async function run(mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('entries', mode);
      const request = action(transaction.objectStore('entries'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('storage_failed'));
      transaction.onerror = () => reject(transaction.error);
    });
  }
  window.ManiDiaryStore = {
    all: () => run('readonly', s => s.getAll()),
    save: entry => run('readwrite', s => s.put(entry)),
    remove: id => run('readwrite', s => s.delete(id)),
  };
})();
