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
  const flipBtn = document.getElementById('flipBtn');
  const permBtn = document.getElementById('permBtn');
  const workBtn = document.getElementById('workBtn');
  const workOverlay = document.getElementById('workOverlay');
  const workImg = document.getElementById('workImg');
  const workClose = document.getElementById('workClose');
  const workPrev = document.getElementById('workPrev');
  const workNext = document.getElementById('workNext');
  const workCaption = document.getElementById('workCaption');
  const workDots = document.getElementById('workDots');

  // Названия 5 дизайнов — в том же порядке, что и фото в works[]
  const DESIGN_LABELS = ['Цветной френч', 'Омбре', 'Мрамор', 'Минимализм', 'Хром + глиттер'];

  let currentIndex = -1;
  let hasCard = false;
  let isFlipped = false;
  let isAnimating = false;
  let currentWorks = [];
  let workPos = 0;

  function setHint(text) {
    hintEl.textContent = text;
  }

  function pickNewIndex() {
    if (CARDS.length === 1) return 0;
    let idx;
    do {
      idx = Math.floor(Math.random() * CARDS.length);
    } while (idx === currentIndex);
    return idx;
  }

  function drawCard() {
    if (isAnimating) return;
    isAnimating = true;

    currentIndex = pickNewIndex();
    const data = CARDS[currentIndex];

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
    if (currentWorks.length > 0) {
      workBtn.classList.remove('hidden');
    } else {
      workBtn.classList.add('hidden');
    }

    hasCard = true;
    flipBtn.disabled = false;
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
  flipBtn.addEventListener('click', flipCard);
  shakeBtn.addEventListener('click', drawCard);

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

  function showWork(i) {
    if (i < 0 || i >= currentWorks.length) return;
    workPos = i;
    workImg.src = currentWorks[i];
    const label = DESIGN_LABELS[i] || ('Дизайн ' + (i + 1));
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

  // Свайп пальцем по галерее
  let touchX = null;
  workOverlay.addEventListener('touchstart', (e) => {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  workOverlay.addEventListener('touchend', (e) => {
    if (touchX === null) return;
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

    if (lastAcc) {
      const delta =
        Math.abs(acc.x - lastAcc.x) +
        Math.abs(acc.y - lastAcc.y) +
        Math.abs(acc.z - lastAcc.z);

      const now = Date.now();
      if (delta > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN) {
        lastShakeTime = now;
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
})();
