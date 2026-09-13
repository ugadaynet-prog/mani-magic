// Подбор по длине и форме ногтей.
// Метки у работы необязательны: старые фото считаются универсальными и не
// исчезают из каталога, пока мастер не разметит их точнее.
(() => {
  'use strict';

  const ANY = 'any';
  const lengths = [
    { key: 'short', label: 'Короткие' },
    { key: 'medium', label: 'Средние' },
    { key: 'long', label: 'Длинные' },
  ];
  const shapes = [
    { key: 'square', label: 'Квадрат' },
    { key: 'soft-square', label: 'Мягкий квадрат' },
    { key: 'oval', label: 'Овал' },
    { key: 'almond', label: 'Миндаль' },
    { key: 'stiletto', label: 'Стилет' },
  ];
  const lengthKeys = new Set(lengths.map((item) => item.key));
  const shapeKeys = new Set(shapes.map((item) => item.key));
  const STORAGE_KEY = 'maniMagicFit';

  function cleanList(value, allowed) {
    if (Array.isArray(value)) return value.filter((item) => allowed.has(item));
    if (typeof value === 'string' && allowed.has(value)) return [value];
    return [];
  }

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      length: lengthKeys.has(source.length) ? source.length : ANY,
      shape: shapeKeys.has(source.shape) ? source.shape : ANY,
    };
  }

  function read() {
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch { return normalize({}); }
  }

  function write(value) {
    const next = normalize(value);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  function metaFor(card, index) {
    const explicit = card?.workMeta?.[index] || card?.workFit?.[index];
    if (!explicit || typeof explicit !== 'object') {
      // Для встроенной колоды используем мягкую подсказку по названию техники.
      // Это не запрет: неизвестные сочетания остаются универсальными, а
      // точные метки мастера всегда имеют приоритет.
      const label = String(card?.workLabels?.[index] || '').toLowerCase();
      if (!label) return null;
      const longHints = /френч|омбре|baby boomer|кружево|3d|цветоч|мотив|полос|колор-блок|леопард|звезд|космос/;
      const shortHints = /однотон|микрофренч|негатив|точк/;
      const shapeHints = /френч|омбре|baby boomer|микрофренч/;
      return {
        lengths: longHints.test(label) ? ['medium', 'long'] : shortHints.test(label) ? ['short', 'medium'] : [...lengthKeys],
        shapes: shapeHints.test(label) ? ['square', 'soft-square', 'oval', 'almond'] : [...shapeKeys],
        tagged: false,
      };
    }
    const allowedLengths = cleanList(explicit.lengths ?? explicit.length, lengthKeys);
    const allowedShapes = cleanList(explicit.shapes ?? explicit.shape, shapeKeys);
    return {
      lengths: allowedLengths.length ? allowedLengths : [...lengthKeys],
      shapes: allowedShapes.length ? allowedShapes : [...shapeKeys],
      tagged: true,
    };
  }

  function matches(card, index, preferences) {
    const prefs = normalize(preferences);
    const meta = metaFor(card, index);
    if (!meta) return true;
    return (prefs.length === ANY || meta.lengths.includes(prefs.length))
      && (prefs.shape === ANY || meta.shapes.includes(prefs.shape));
  }

  function cardMatches(card, preferences) {
    const works = Array.isArray(card?.works) ? card.works : [];
    return works.some((_, index) => matches(card, index, preferences));
  }

  function matchingIndices(card, preferences) {
    const works = Array.isArray(card?.works) ? card.works : [];
    return works.map((_, index) => index).filter((index) => matches(card, index, preferences));
  }

  function label(kind, key) {
    if (key === ANY) return kind === 'length' ? 'Любая длина' : 'Любая форма';
    const source = kind === 'length' ? lengths : shapes;
    return source.find((item) => item.key === key)?.label || '';
  }

  function summary(preferences) {
    const prefs = normalize(preferences);
    if (prefs.length === ANY && prefs.shape === ANY) return 'Любые ногти';
    return [prefs.length === ANY ? '' : label('length', prefs.length), prefs.shape === ANY ? '' : label('shape', prefs.shape)]
      .filter(Boolean).join(' · ');
  }

  window.ManiFit = { ANY, lengths, shapes, normalize, read, write, metaFor, matches, cardMatches, matchingIndices, label, summary };
})();
