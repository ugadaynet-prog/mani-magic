/* Заставка MANI Magic: капли жидкого графита слетаются и перетекают в логотип,
 * следом появляется слоган «Не можешь выбрать цвет? / Тряхни колоду».
 *
 * Слоган — не украшение, а инструкция: он учит главному жесту. Поэтому текст
 * рисуется обычным DOM, а не шейдером: он должен быть резким и читаемым, а
 * металлические буквы в 18 пикселей нечитаемы.
 *
 * Четыре способа связать логотип со слоганом (o.slogan.mode):
 *   'a' — слоган просто проступает под знаком
 *   'b' — капля стекает вниз и разливается, оставляя за собой строку
 *   'v' — блик со знака перетекает на слоган и уходит
 *   'g' — как 'a', плюс знак вздрагивает на слове «тряхни»
 *   'none' — без слогана
 *
 * Почему капли задаются отдельно, а не «вырастают» из логотипа: в знаке
 * 15.8% заливки, остальное воздух. Размытие волосяных штрихов даёт лохмотья,
 * а не каплю — проверено. Поэтому тела капель это меташары, которые
 * по-настоящему слипаются перемычками, а логотип для них цель движения.
 */
(function (global) {
  'use strict';

  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res; uniform float u_t; uniform float u_scale;',
    'uniform float u_shake;',      // горизонтальный сдвиг знака, вариант «г»
    'uniform float u_drop;',       // прогресс капли-слогана, <0 — выключено
    'uniform float u_dropY;',      // куда падает капля, в экранных единицах
    'uniform float u_dropX; uniform float u_dropW;',
    'uniform sampler2D u_logo;',
    'const vec3 BRAND = vec3(0.173,0.180,0.208);',
    'const vec3 PAPER = vec3(1.0);',
    'const int NB = 7;',

    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vnoise(p);p*=2.03;a*=.5;}return s;}',
    // Завихрение: сдвиг по градиенту шума, повёрнутому на 90°. Капля тянется,
    // а не трясётся на месте.
    'vec2 curl(vec2 p){float e=.06;',
    ' return vec2(fbm(p+vec2(0,e))-fbm(p-vec2(0,e)), fbm(p-vec2(e,0))-fbm(p+vec2(e,0)))/(2.*e);}',

    'vec2 toLogo(vec2 p){return vec2(p.x-u_shake,-p.y)/u_scale+.5;}',
    'float logoAt(vec2 uv){',
    ' if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) return 0.;',
    ' return texture2D(u_logo,uv).a;}',
    // Размытая маска нужна только в середине сцены. К финалу радиус падает
    // до нуля, ветка отключается, и логотип рисуется точно самим собой.
    'float logoBlur(vec2 uv,float r){',
    ' if(r<0.001) return logoAt(uv);',
    ' float s=logoAt(uv);',
    ' for(int i=0;i<8;i++){float a=float(i)*.7854;vec2 o=vec2(cos(a),sin(a))*r;',
    '  s+=logoAt(uv+o)+logoAt(uv+o*.55);}',
    ' return s/17.;}',
    // Нормаль по сырой маске: для бликов нужен край знака, а не край размытия.
    'vec2 maskNormal(vec2 uv){float e=.006;',
    ' return vec2(logoAt(uv+vec2(e,0))-logoAt(uv-vec2(e,0)),',
    '             logoAt(uv+vec2(0,e))-logoAt(uv-vec2(0,e)))/(2.*e);}',

    'vec2 anchor(int i){',
    ' if(i==0) return vec2(.13,.42); if(i==1) return vec2(.31,.30);',
    ' if(i==2) return vec2(.46,.46); if(i==3) return vec2(.60,.28);',
    ' if(i==4) return vec2(.80,.42); if(i==5) return vec2(.40,.74);',
    ' return vec2(.62,.80);}',
    'vec3 blobs(vec2 uv,float g,float t){',
    ' float f=0.; vec2 gr=vec2(0.);',
    ' for(int i=0;i<NB;i++){ float fi=float(i);',
    '  vec2 a=anchor(i);',
    '  vec2 away=vec2(cos(fi*2.1+.7),sin(fi*1.7+1.3))*.85;',
    '  vec2 c=mix(a+away,a,g)+vec2(sin(t*3.+fi),cos(t*2.4+fi*1.7))*.02*(1.-g);',
    '  float r=mix(.16,.075,g)*(.8+.35*fract(fi*.37));',
    '  vec2 d=(uv-c)*vec2(1.,1.25);',
    '  float q=max(dot(d,d),1e-4);',
    '  f+=r*r/q;',
    '  gr+=-2.*r*r*d/(q*q)*vec2(1.,1.25);}',
    ' return vec3(f,gr);}',

    // Графит: тёмная масса с яркой полосой горизонта. Издали знак читается
    // своим фирменным цветом, вблизи видно, что он металлический.
    'vec3 graphite(vec2 uv,vec2 n,float sweep){',
    ' float h=(uv.y-.44)*2.2+n.y*.45+sweep;',
    ' vec3 c=mix(vec3(.50,.52,.57), BRAND*.85, smoothstep(-.12,.26,h));',
    ' c+=pow(max(0.,1.-abs(h)*4.5),3.)*.75;',
    ' c+=pow(max(0.,n.y*.5-n.x*.35),2.)*.18;',
    ' return c;}',

    'void main(){',
    ' vec2 p=(gl_FragCoord.xy-.5*u_res)/min(u_res.x,u_res.y);',
    ' float t=clamp(u_t,0.,1.);',
    // Фон — тот же белый, что в приложении, с еле заметным затемнением к краю.
    ' vec3 col=mix(PAPER,vec3(.955,.955,.965),smoothstep(.25,.85,length(p)));',

    ' float gather=smoothstep(.04,.50,t);',
    ' float form  =smoothstep(.44,.86,t);',
    ' float amp   =.035*(1.-form);',
    ' float blur  =.095*(1.-form);',

    ' vec2 uv=toLogo(p);',
    ' if(amp>.001) uv+=curl(uv*3.+vec2(0.,t*.8))*amp;',

    ' vec3 bf=blobs(uv,gather,t);',
    ' float mb=smoothstep(.75,1.35,bf.x);',
    ' float e0=mix(.20,.5,form);',
    ' float ml=smoothstep(e0-.08,e0+.08,logoBlur(uv,blur));',
    ' float body=mix(mb,ml,form)*smoothstep(0.,.10,t);',

    ' vec2 n=mix(normalize(bf.yz+vec2(1e-5))*.9, maskNormal(uv), form);',
    // Блик один раз проходит по знаку и останавливается: металл живой, но
    // финальный кадр статичен, его можно держать сколько угодно.
    ' float sweep=mix(-.95,0.,smoothstep(.50,1.,t));',
    ' col=mix(col,graphite(uv,n,sweep),body);',

    // Вариант «б»: капля отделяется, падает к строке слогана и разливается
    // в тонкую лужицу. Текст открывается следом за ней — см. JS.
    ' if(u_drop>=0.){',
    '  float d=clamp(u_drop,0.,1.);',
    '  float fall=smoothstep(0.,.55,d);',
    '  float spread=smoothstep(.5,1.,d);',
    '  float sx=1.+spread*u_dropW;',
    '  float r=.026*(1.-.30*spread);',
    // Центр смещаем вместе с ростом: лужица растекается слева направо, за
    // ней открывается текст. Симметричный рост читался бы как клякса.
    '  float w=r*sx*1.15;',
        // Капля стекает ИЗ знака: по горизонтали она едет от точки под
    // логотипом к левому краю строки, а не возникает там сама.
    '  vec2 c=vec2(mix(.05, u_dropX+w, fall*fall), mix(-.5*u_scale+.02, u_dropY, fall));',
    '  vec2 q=(p-c)/vec2(sx, 1.-spread*.72);',
    '  float fld=r*r/max(dot(q,q),1e-6);',
    '  float db=smoothstep(.75,1.35,fld);',
    '  float ny=q.y*2.4;',
    '  vec3 pc=mix(vec3(.50,.52,.57), BRAND*.85, smoothstep(-.5,.5,ny));',
    '  pc+=pow(max(0.,1.-abs(ny+.35)*3.),3.)*.5;',
    '  col=mix(col,pc,db);',
    ' }',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  // Сколько идёт сцена и сколько держим готовый кадр — у каждого варианта своё.
  // Слоган надо успеть прочитать, поэтому там, где он появляется поздно,
  // выдержка длиннее.
  var TIMING = {
    none: { duration: 1500, hold: 260 },
    a:    { duration: 1650, hold: 620 },
    v:    { duration: 1700, hold: 620 },
    g:    { duration: 1750, hold: 620 },
    b:    { duration: 2050, hold: 520 }
  };

  var SLOGAN_HTML = 'Не можешь выбрать цвет?<br>Тряхни колоду';

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function ease(x) { return x * x * (3 - 2 * x); }

  /**
   * @param {Object} o
   * @param {string} o.logo               путь к квадратной PNG 1024×1024
   * @param {Object|string} [o.slogan]    {mode, html} либо просто режим строкой
   * @param {number} [o.duration]         длительность сцены, мс (по умолчанию от режима)
   * @param {number} [o.hold]             держать готовый кадр, мс
   * @param {number} [o.speed=1]          множитель времени: 2.6 — медленный показ
   * @param {string} [o.once='session']   'session' | 'always' | 'never'
   * @param {number} [o.scale=0.62]       доля короткой стороны экрана под логотип
   * @param {Function} [o.onDone]
   */
  function maniSplash(o) {
    o = o || {};
    var sl = o.slogan;
    if (typeof sl === 'string') sl = { mode: sl };
    var mode = (sl && sl.mode) || 'none';
    if (!TIMING[mode]) mode = 'none';
    var sloganHtml = (sl && sl.html) || SLOGAN_HTML;

    // Один множитель на всю сцену. Растягивать заставку удобнее им, чем
    // двумя числами: пропорции между фазами при этом не едут.
    var speed = o.speed || 1;
    var duration = Math.round((o.duration || TIMING[mode].duration) * speed);
    var hold = Math.round((o.hold == null ? TIMING[mode].hold : o.hold) * speed);
    var once = o.once || 'session';
    var scale = o.scale || 0.62;
    var done = o.onDone || function () {};

    var KEY = 'maniSplashShown';
    var reduced = false;
    try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    if (once === 'never') return done();
    if (once === 'session') {
      try {
        if (sessionStorage.getItem(KEY)) return done();
        sessionStorage.setItem(KEY, '1');
      } catch (e) {}
    }

    var root = document.createElement('div');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;' +
      'transition:opacity .26s ease;contain:strict;touch-action:none';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    root.appendChild(canvas);

    var text = null;
    if (mode !== 'none') {
      text = document.createElement('p');
      text.innerHTML = sloganHtml;
      text.style.cssText = 'position:absolute;left:0;right:0;margin:0;padding:0 24px;' +
        'text-align:center;color:#14141a;font-family:Georgia,"Times New Roman",serif;' +
        'font-style:italic;font-weight:600;line-height:1.4;' +
        'font-size:clamp(16px,4.6vw,21px);opacity:0;will-change:opacity,transform';
      root.appendChild(text);
    }
    document.body.appendChild(root);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      root.style.opacity = '0';
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        done();
      }, 280);
    }
    root.addEventListener('pointerdown', finish);

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false })
        || canvas.getContext('experimental-webgl');
    } catch (e) {}

    // Статичный запасной кадр. Нужен в двух случаях: нет WebGL и включено
    // системное «уменьшить движение». Заставка у приложения одна, поэтому
    // просто пропустить нельзя — слоган учит главному жесту, его показываем
    // всегда, просто без движения.
    function staticFallback(ms) {
      var img = new Image();
      img.src = o.logo;
      img.style.cssText = 'position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);' +
        'width:52%;max-width:420px';
      root.appendChild(img);
      if (text) {
        text.style.top = '62%';
        text.style.opacity = '1';
        text.style.clipPath = 'none';
      }
      setTimeout(finish, ms);
    }

    if (reduced) { staticFallback(1400); return; }
    if (!gl) { staticFallback(1000); return; }

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog));
      }
    } catch (e) { finish(); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['u_res', 'u_t', 'u_scale', 'u_shake', 'u_drop', 'u_dropY', 'u_dropX', 'u_dropW', 'u_logo']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]));

    var dropY = -0.42, dropX = -0.3, dropW = 10;
    function place() {
      var dprCap = +(new URLSearchParams(location.search).get('dpr')) || 1.5;
      var dpr = Math.min(global.devicePixelRatio || 1, dprCap);
      canvas.width = Math.max(1, Math.round(innerWidth * dpr));
      canvas.height = Math.max(1, Math.round(innerHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);

      // Знак занимает scale короткой стороны и стоит по центру, значит его
      // нижний край — центр плюс половина этой высоты. Слоган ставим под него.
      var mn = Math.min(innerWidth, innerHeight);
      var bottom = innerHeight / 2 + 0.5 * scale * mn;
      if (text) {
        text.style.top = Math.round(bottom + 0.03 * mn) + 'px';
        var r = text.getBoundingClientRect();
        // Ширину строки меряем клоном: <p> растянут на всю ширину, а лужица
        // должна кончаться там же, где кончаются буквы, иначе она вылезает
        // за текст и читается как смазанная клякса.
        var probe = text.cloneNode(true);
        probe.style.left = 'auto'; probe.style.right = 'auto';
        probe.style.display = 'inline-block';
        probe.style.visibility = 'hidden';
        probe.style.opacity = '1';
        probe.style.clipPath = 'none';
        root.appendChild(probe);
        var lineW = probe.getBoundingClientRect().width;
        root.removeChild(probe);

        // Всё в единицах шейдера: доля короткой стороны от центра, ось вверх.
        // Капля падает под текст и подчёркивает его, а не ложится поперёк.
        dropY = -((r.bottom + 0.012 * mn) - innerHeight / 2) / mn;
        dropX = -(lineW / 2) / mn;
        dropW = Math.max(2, (lineW / mn) / (0.026 * 1.15 * 2) - 1);
      }
    }
    addEventListener('resize', place);
    place();

    // --- поведение слогана по вариантам ---
    var shineOk = false;
    try {
      shineOk = CSS.supports('-webkit-background-clip', 'text') ||
                CSS.supports('background-clip', 'text');
    } catch (e) {}

    var SHINE = 'linear-gradient(100deg,#14141a 0%,#14141a 38%,#9aa2b1 46%,' +
                '#e8ecf4 50%,#9aa2b1 54%,#14141a 62%,#14141a 100%)';
    if (mode === 'v' && text && shineOk) {
      text.style.backgroundImage = SHINE;
      text.style.backgroundSize = '320% 100%';
      text.style.webkitBackgroundClip = 'text';
      text.style.backgroundClip = 'text';
      text.style.color = 'transparent';
      text.style.backgroundPosition = '100% 0';
    }
    var shineOff = false;

    function updateSlogan(t) {
      if (!text) return;

      if (mode === 'a' || mode === 'g') {
        var k = ease(ramp(t, 0.66, 0.86));
        text.style.opacity = k;
        text.style.transform = 'translateY(' + ((1 - k) * 10).toFixed(1) + 'px)';
      }

      if (mode === 'v') {
        // Слоган ждёт бледным, пока собирается знак, и вспыхивает, когда по
        // нему проходит тот же блик, что по логотипу.
        var base = ease(ramp(t, 0.50, 0.70));
        text.style.opacity = (0.28 + 0.72 * ease(ramp(t, 0.84, 0.98))) * base;
        if (shineOk) {
          var s = ramp(t, 0.84, 1.0);
          text.style.backgroundPosition = (100 - 100 * s).toFixed(1) + '% 0';
          // После прохода блика возвращаем сплошной цвет: градиент по тексту
          // на слабых экранах слегка мылит буквы.
          if (t >= 0.995 && !shineOff) {
            shineOff = true;
            text.style.backgroundImage = 'none';
            text.style.color = '#14141a';
          }
        }
      }

      if (mode === 'b') {
        // Текст открывается слева направо ровно за растекающейся каплей.
        var sp = ramp(t, 0.78, 0.98);
        text.style.opacity = sp > 0 ? 1 : 0;
        text.style.clipPath = 'inset(0 ' + (100 - 100 * ease(sp)).toFixed(1) + '% 0 0)';
        text.style.webkitClipPath = text.style.clipPath;
      }
    }

    function shakeAt(t) {
      // Вариант «г»: знак вздрагивает ровно на строке «Тряхни колоду» —
      // жест показан, а не только назван. Затухающая синусоида, 4 колебания.
      if (mode !== 'g') return 0;
      var k = ramp(t, 0.86, 1.0);
      if (k <= 0 || k >= 1) return 0;
      return Math.sin(k * Math.PI * 8) * 0.016 * (1 - k);
    }

    function dropAt(t) {
      if (mode !== 'b') return -1;
      return t < 0.60 ? -1 : ramp(t, 0.60, 0.96);
    }

    var start = 0;
    function frame(now) {
      if (finished) return;
      if (!start) start = now;
      // Отладка: freeze останавливает сцену на кадре, чтобы его можно было
      // снять и рассмотреть, а не ловить на глаз в движении.
      var t = o.freeze != null ? o.freeze : Math.min((now - start) / duration, 1);

      gl.uniform2f(U.u_res, canvas.width, canvas.height);
      gl.uniform1f(U.u_t, t);
      gl.uniform1f(U.u_scale, scale);
      gl.uniform1f(U.u_shake, shakeAt(t));
      gl.uniform1f(U.u_drop, dropAt(t));
      gl.uniform1f(U.u_dropY, dropY);
      gl.uniform1f(U.u_dropX, dropX);
      gl.uniform1f(U.u_dropW, dropW);
      gl.uniform1i(U.u_logo, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      updateSlogan(t);

      if (o.freeze != null) return;
      if (t >= 1) { setTimeout(finish, hold); return; }
      requestAnimationFrame(frame);
    }

    var logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.onload = function () {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logo);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // Текстура 1024×1024 — степень двойки, поэтому мип-уровни доступны.
      // Без них волосяные штрихи знака рассыпаются в муар при уменьшении.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      place();
      requestAnimationFrame(frame);
    };
    logo.onerror = finish;
    logo.src = o.logo;

    // Предохранитель: что бы ни случилось с кадрами, вкладку не держим.
    if (o.freeze == null) setTimeout(finish, duration + hold + 1500);
  }

  maniSplash.timing = TIMING;
  global.maniSplash = maniSplash;
})(window);
