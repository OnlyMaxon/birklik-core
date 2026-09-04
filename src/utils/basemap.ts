/**
 * Единый источник тайлов карты — для сайта и для приложения.
 *
 * CARTO с 2026 года требует ключ на растровых (PNG) тайлах. Тайл при этом
 * по-прежнему отдаётся с кодом 200 — поверх картинки просто печатается
 * «API KEY REQUIRED», поэтому ни один обработчик ошибок такое не поймает.
 * Ловится это только глазами, и именно так однажды и поймали.
 *
 * Ключ бесплатный (5 млн тайлов в месяц) и публичный по своей природе: он
 * уходит в каждом запросе тайла, спрятать его нельзя. Поэтому он приходит
 * аргументом, а не читается здесь из окружения: у сайта переменная называется
 * `NEXT_PUBLIC_CARTO_API_KEY`, у приложения `EXPO_PUBLIC_CARTO_API_KEY`, и
 * общий код о таких различиях знать не должен.
 *
 * Без ключа откатываемся на тайлы OpenStreetMap: карта выглядит иначе, но
 * остаётся читаемой и без надписи поперёк.
 */

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const OSM_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const OSM_ATTRIBUTION_TEXT = '© OpenStreetMap'

export interface Basemap {
  /** Шаблон адреса тайла. `{r}` подставляет Leaflet; вне его подставлять нечем. */
  url: string
  /** Подпись с разметкой — для веба. */
  attributionHtml: string
  /** Подпись обычным текстом — для приложения, там разметки нет. */
  attributionText: string
  /** Ключ CARTO задан и тайлы идут оттуда. */
  usingCarto: boolean
}

/**
 * @param key ключ CARTO из окружения вызывающей стороны; пустой или
 *            отсутствующий означает откат на OpenStreetMap
 * @param retina поддерживает ли вызывающая сторона подстановку `{r}` —
 *               Leaflet умеет, MapLibre нет
 */
export function basemap(key?: string, retina = false): Basemap {
  const carto = key?.trim()

  if (!carto) {
    return {
      url: OSM_URL,
      attributionHtml: OSM_ATTRIBUTION_HTML,
      attributionText: OSM_ATTRIBUTION_TEXT,
      usingCarto: false
    }
  }

  // Субдомены {s} у CARTO живы, но в их документации по ключу их уже нет, да и
  // под HTTP/2 дробление по хостам смысла не даёт.
  const suffix = retina ? '{r}' : ''

  return {
    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}${suffix}.png?key=${carto}`,
    attributionHtml: `${OSM_ATTRIBUTION_HTML} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    attributionText: `${OSM_ATTRIBUTION_TEXT} © CARTO`,
    usingCarto: true
  }
}
