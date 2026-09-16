/* Премиальная заставка MANI Magic: спокойное появление логотипа на
 * баклажановом фоне и один мягкий перламутровый проход. */
(function (global) {
  'use strict';

  var STYLE = [
    '@keyframes maniSplashLogo {',
    '  0% { opacity: 0; transform: scale(.86); filter: blur(8px); }',
    '  38% { opacity: 1; transform: scale(1); filter: blur(0); }',
    '  100% { opacity: 1; transform: scale(1); filter: blur(0); }',
    '}',
    '@keyframes maniSplashSheen {',
    '  0% { transform: translateX(-180%) skewX(-18deg); opacity: 0; }',
    '  24% { opacity: 0; }',
    '  46% { opacity: .7; }',
    '  70% { transform: translateX(460%) skewX(-18deg); opacity: 0; }',
    '  100% { transform: translateX(460%) skewX(-18deg); opacity: 0; }',
    '}',
    '@keyframes maniSplashFade {',
    '  from { opacity: 1; } to { opacity: 0; }',
    '}',
    '#maniSplashLogo { animation: maniSplashLogo 1.45s cubic-bezier(.2,.75,.25,1) both; }',
    '#maniSplashSheen { animation: maniSplashSheen 1.8s cubic-bezier(.2,.7,.25,1) .18s both; }',
    '#maniSplash.mani-splash-out { animation: maniSplashFade .28s ease both; }',
    '@media (prefers-reduced-motion: reduce) {',
    '  #maniSplashLogo { animation: none; opacity: 1; transform: none; filter: none; }',
    '  #maniSplashSheen { display: none; }',
    '}'
  ].join('');

  function maniSplash(options) {
    options = options || {};
    var once = options.once || 'session';
    var duration = Math.max(1200, Number(options.duration) || 1850);
    var hold = Math.max(120, Number(options.hold) || 260);
    var key = 'maniSplashShown';

    if (once === 'never') {
      if (typeof options.onDone === 'function') options.onDone();
      return;
    }
    if (once === 'session') {
      try {
        if (sessionStorage.getItem(key)) {
          if (typeof options.onDone === 'function') options.onDone();
          return;
        }
        sessionStorage.setItem(key, '1');
      } catch (e) {}
    }

    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'maniSplash';
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:hidden;' +
      'display:grid;place-items:center;background:#1b0c22;touch-action:none;';

    var frame = document.createElement('div');
    frame.style.cssText = 'position:relative;width:min(58vw,300px);aspect-ratio:1;' +
      'display:grid;place-items:center;overflow:hidden;';

    var logo = document.createElement('img');
    logo.id = 'maniSplashLogo';
    logo.alt = 'MANI Magic';
    logo.src = options.logo || 'assets/logo-splash.png';
    logo.style.cssText = 'position:relative;z-index:1;width:100%;height:100%;object-fit:contain;' +
      'filter:drop-shadow(0 14px 24px rgba(0,0,0,.28));';

    var sheen = document.createElement('span');
    sheen.id = 'maniSplashSheen';
    sheen.style.cssText = 'position:absolute;z-index:2;top:-18%;left:0;width:18%;height:136%;' +
      'background:rgba(255,255,255,.42);filter:blur(12px);pointer-events:none;';

    frame.appendChild(logo);
    frame.appendChild(sheen);
    root.appendChild(frame);
    document.body.appendChild(root);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      root.classList.add('mani-splash-out');
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        if (style.parentNode) style.parentNode.removeChild(style);
        if (typeof options.onDone === 'function') options.onDone();
      }, 300);
    }

    root.addEventListener('pointerdown', finish, { once: true });
    setTimeout(finish, duration + hold);
    logo.addEventListener('error', finish, { once: true });
  }

  maniSplash.timing = { none: { duration: 1850, hold: 260 } };
  global.maniSplash = maniSplash;
})(window);
