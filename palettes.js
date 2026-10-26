// Палитры брендов-партнёров: оттенки для примерки и подсказки «ближайший оттенок»
// под работами колоды. Здесь только данные — логика в brands.js.
//
// Новый бренд — новый блок в brands: id (латиница), name, shades [{code, name, hex}].
// Коды и названия — как на флаконе, hex — от бренда (по фото палитры цвет врёт).
// test: true — бренд виден только после ?brandtest=1 (для проверки, не для клиенток).
//
// Приложение из RuStore, когда есть сеть, подгружает этот же файл с
// https://mani-magic.ru/app/palettes.js — новые бренды появляются без новой сборки.
window.BRAND_PALETTES = {
  updated: '2026-10-26',
  brands: [
    {
      id: 'test',
      name: 'Тестовый бренд',
      test: true,
      shades: [
        { code: '101', name: 'Фарфор', hex: '#F3E3DA' },
        { code: '102', name: 'Пудра', hex: '#E8C4B8' },
        { code: '103', name: 'Нюд', hex: '#D9A68F' },
        { code: '104', name: 'Пыльная роза', hex: '#C98A8E' },
        { code: '105', name: 'Фламинго', hex: '#F28BA8' },
        { code: '106', name: 'Фуксия', hex: '#D6247A' },
        { code: '107', name: 'Алый', hex: '#D62828' },
        { code: '108', name: 'Вишня', hex: '#8E1B2E' },
        { code: '109', name: 'Бордо', hex: '#5C1A24' },
        { code: '110', name: 'Терракота', hex: '#B5543A' },
        { code: '111', name: 'Апельсин', hex: '#EE7A2E' },
        { code: '112', name: 'Персик', hex: '#F6B48F' },
        { code: '113', name: 'Лимон', hex: '#F4DD5A' },
        { code: '114', name: 'Горчица', hex: '#C9A227' },
        { code: '115', name: 'Олива', hex: '#6F7B3A' },
        { code: '116', name: 'Мята', hex: '#A8DCC4' },
        { code: '117', name: 'Изумруд', hex: '#0F7A5F' },
        { code: '118', name: 'Бирюза', hex: '#3FBAC2' },
        { code: '119', name: 'Небо', hex: '#9CC9EA' },
        { code: '120', name: 'Кобальт', hex: '#2353A6' },
        { code: '121', name: 'Ночь', hex: '#1E2A4F' },
        { code: '122', name: 'Лаванда', hex: '#B9A2D4' },
        { code: '123', name: 'Слива', hex: '#5E2B5C' },
        { code: '124', name: 'Молочный', hex: '#F7F3EC' },
        { code: '125', name: 'Графит', hex: '#2E2C30' },
        { code: '126', name: 'Шоколад', hex: '#5A3A2A' }
      ]
    }
  ]
};
