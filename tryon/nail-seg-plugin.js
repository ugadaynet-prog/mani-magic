'use strict';
// Общий адаптер сегментации для Android и браузера.
// Файл загружается ДО tryon.js в index.html.

(() => {
  const native = !!window.Capacitor?.isNativePlatform?.();

  if (!native) {
    const SIZE = 576;
    const RING = 7;
    const SKIN_MIN = 0.22;
    let sessionPromise;
    // The UMD build does not expose `window.ort` in every WebView/browser.
    // Load the local ESM build on demand so the first photo still works.
    const ortPromise = window.ort
      ? Promise.resolve(window.ort)
      : import(new URL('../vendor/onnxruntime/ort.min.mjs?v=147', document.baseURI).href)
          .then(module => {
            const runtime = module.default || module;
            window.ort = runtime;
            return runtime;
          });

    const sigmoid = value => {
      if (value >= 0) return 1 / (1 + Math.exp(-value));
      const e = Math.exp(value);
      return e / (1 + e);
    };

    function inputFromImage(image) {
      const scale = SIZE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
      const width = Math.max(1, Math.trunc((image.naturalWidth || image.width) * scale));
      const height = Math.max(1, Math.trunc((image.naturalHeight || image.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.fillStyle = '#000';
      context.fillRect(0, 0, SIZE, SIZE);
      context.drawImage(image, Math.trunc((SIZE - width) / 2), Math.trunc((SIZE - height) / 2), width, height);
      const pixels = context.getImageData(0, 0, SIZE, SIZE).data;
      const plane = SIZE * SIZE;
      const chw = new Float32Array(plane * 3);
      for (let i = 0; i < plane; i++) {
        chw[i] = pixels[i * 4] / 255;
        chw[plane + i] = pixels[i * 4 + 1] / 255;
        chw[plane * 2 + i] = pixels[i * 4 + 2] / 255;
      }
      return { tensor: new window.ort.Tensor('float32', chw, [1, 3, SIZE, SIZE]), chw };
    }

    // Mirrors NailSegmentationPlugin.suppressStrayBlobs so the browser and
    // Android paths reject the same reflective objects in a hand photo.
    function suppressStrayBlobs(logits, chw) {
      const n = SIZE * SIZE;
      const probabilities = new Float32Array(n);
      for (let i = 0; i < n; i++) probabilities[i] = sigmoid(logits[i]);
      const fg = new Uint8Array(n);
      const labels = new Int32Array(n);
      labels.fill(-1);
      const areas = [];
      const boxes = [];
      const queue = new Int32Array(n);
      for (let start = 0; start < n; start++) {
        if (probabilities[start] <= 0.5 || labels[start] >= 0) continue;
        const id = areas.length;
        let head = 0, tail = 0, area = 0;
        let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
        queue[tail++] = start;
        labels[start] = id;
        fg[start] = 1;
        while (head < tail) {
          const p = queue[head++];
          area++;
          const x = p % SIZE, y = Math.trunc(p / SIZE);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
            const q = ny * SIZE + nx;
            if (fg[q] || probabilities[q] <= 0.5) continue;
            fg[q] = 1;
            labels[q] = id;
            queue[tail++] = q;
          }
        }
        areas.push(area);
        boxes.push([x0, y0, x1, y1]);
      }

      const skinAt = index => {
        const r = chw[index] * 255, g = chw[n + index] * 255, b = chw[n * 2 + index] * 255;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        return cb >= 77 && cb <= 130 && cr >= 133 && cr <= 177;
      };

      for (let id = 0; id < areas.length; id++) {
        const [x0, y0, x1, y1] = boxes[id];
        const bx0 = Math.max(0, x0 - RING), by0 = Math.max(0, y0 - RING);
        const bx1 = Math.min(SIZE - 1, x1 + RING), by1 = Math.min(SIZE - 1, y1 + RING);
        let skin = 0, total = 0;
        for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
          const p = y * SIZE + x;
          if (fg[p]) continue;
          let touches = false;
          for (let dy = -RING; dy <= RING && !touches; dy++) for (let dx = -RING; dx <= RING; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && labels[ny * SIZE + nx] === id) {
              touches = true;
              break;
            }
          }
          if (!touches) continue;
          total++;
          if (skinAt(p)) skin++;
        }
        if (total >= 20 && skin / total < SKIN_MIN) {
          for (let i = 0; i < n; i++) if (labels[i] === id) logits[i] = -30;
        }
      }
      return logits;
    }

    async function getSession() {
      if (!sessionPromise) {
        sessionPromise = ortPromise.then(ort => {
          const wasmRoot = new URL('../vendor/onnxruntime/', document.baseURI).href;
          // Explicit versioned URLs bypass an older WebView HTTP cache that may
          // contain the WASM response with the wrong MIME type.
          const runtimeVersion = 'v147';
          ort.env.wasm.wasmPaths = {
            mjs: `${wasmRoot}ort-wasm-simd-threaded.mjs?${runtimeVersion}`,
            wasm: `${wasmRoot}ort-wasm-simd-threaded.wasm?${runtimeVersion}`,
          };
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.proxy = false;
          return ort.InferenceSession.create('./nail-unet.onnx', {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'basic',
          });
        }).catch(error => { sessionPromise = null; throw error; });
      }
      return sessionPromise;
    }

    function imageFromDataUrl(dataUrl) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Не удалось декодировать фотографию'));
        image.src = dataUrl;
      });
    }

    async function segment({ image }) {
      const source = await imageFromDataUrl(image);
      // Сначала движок: Tensor берётся из window.ort, а он появляется только после
      // загрузки ort.min.mjs. Фото, выбранное раньше, падало на `ort.Tensor`.
      const session = await getSession();
      const prepared = inputFromImage(source);
      const inputName = session.inputNames[0];
      const outputName = session.outputNames[0];
      const results = await session.run({ [inputName]: prepared.tensor });
      const logits = Float32Array.from(results[outputName].data);
      suppressStrayBlobs(logits, prepared.chw);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
      for (let i = 0; i < SIZE * SIZE; i++) {
        const value = Math.max(0, Math.min(255, Math.trunc(sigmoid(logits[i]) * 255)));
        pixels[i * 4] = value;
        pixels[i * 4 + 1] = value;
        pixels[i * 4 + 2] = value;
        pixels[i * 4 + 3] = 255;
      }
      canvas.getContext('2d').putImageData(new ImageData(pixels, SIZE, SIZE), 0, 0);
      return { mask: canvas.toDataURL('image/png'), elapsedMs: 0 };
    }

    window.ManiNailSegmentation = { segment };
    // Движок и модель — около 16 МБ, и качались они только после выбора фото:
    // 25.09 на сайте первый результат ждали 49 с. Начинаем загрузку сразу, пока
    // человек снимает или выбирает фото. Сбой здесь не страшен: getSession
    // забывает неудачную попытку, и при выборе фото загрузка пойдёт заново.
    getSession().catch(() => {});
  }

  if (!window.Capacitor || !window.Capacitor.Plugins) return;

  const { registerPlugin } = window.Capacitor;
  if (typeof registerPlugin !== 'function') return;

  window.Capacitor.Plugins.NailSegmentation = registerPlugin('NailSegmentation', {
    web: {
      segment: () => Promise.reject(new Error('Нативное распознавание недоступно в браузере')),
    },
  });

  // Сохранение примерки в галерею. Плагин в приложении есть давно
  // (TryOnMediaPlugin.kt, MediaStore), но со стороны страницы его никто не
  // объявлял, и кнопка «Сохранить» падала на браузерное скачивание — файл
  // уезжал в каталог загрузок WebView, где владелец его не нашёл.
  window.Capacitor.Plugins.TryOnMedia = registerPlugin('TryOnMedia', {
    web: {
      saveImage: () => Promise.reject(new Error('Галерея доступна только в приложении')),
    },
  });
})();
