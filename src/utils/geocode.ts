import {resolveCityQuery} from '../data/properties'

/**
 * Поиск адреса — один на сайт и приложение.
 *
 * ⚠️ Нужен потому, что геокодер OpenStreetMap (Nominatim) по Азербайджану
 * почти не работает. Измерено 2026-10-11 живыми запросами:
 *
 * ```
 * Nizami küçəsi 23, Nəsimi rayonu, Bakı   -> ничего
 * Nizami küçəsi, Bakı        (без номера) -> ничего
 * Həsən Əliyev küçəsi 12, Nərimanov, Bakı -> ничего
 * 28 May metrosu yaxınlığı, Bakı          -> ничего
 * Xetai rayonu Baki                       -> «Xetai Fitness» — СПОРТЗАЛ
 * ```
 *
 * Номеров домов в OSM по Баку просто нет, и взять их Nominatim негде. Хуже
 * того, последняя строка — не отказ, а правдоподобная чушь: искали район,
 * получили спортзал с похожим названием. Кодом такое не поймать.
 *
 * Поэтому при наличии токена ищем в Mapbox, а Nominatim оставлен запасным —
 * ровно так же, как у тайлов в `basemap.ts`: ключа нет, картинка хуже, но
 * ничего не падает. Свежий клон без токена работает как раньше.
 *
 * ⚠️ `permanent=true` ОБЯЗАТЕЛЕН и стоит денег ($5 за 1000 против бесплатных
 * 100 000 у временного). Это не недосмотр: координаты уходят в Firestore и
 * живут там, пока живо объявление, а условия Mapbox прямо говорят «temporary
 * results are not allowed to be cached». Убрать параметр, чтобы сэкономить, —
 * значит нарушить условия, а не сэкономить.
 *
 * ⚠️ По той же причине здесь НЕТ подсказок по ходу набора (Search Box API):
 * его ответы запрещено хранить вообще, в любом тарифе. Остаётся кнопка
 * «найти», но за ней — нормальная база адресов.
 */

/** Найденное место. Список таких отдаётся человеку на выбор. */
export interface Place {
  /** Подпись для списка — полный адрес, как его написал справочник. */
  label: string
  lat: number
  lng: number
}

export interface GeocodeOptions {
  /**
   * Публичный токен Mapbox (`pk.…`). Пусто — откат на Nominatim.
   *
   * Публичный он по своей природе, как и ключ CARTO: уходит в каждом запросе,
   * спрятать нельзя. Поэтому приходит аргументом, а не читается здесь из
   * окружения — у сайта переменная `NEXT_PUBLIC_MAPBOX_TOKEN`, у приложения
   * `EXPO_PUBLIC_MAPBOX_TOKEN`, и общий код о таких различиях знать не должен.
   */
  mapboxToken?: string
  /** Язык ответа: на нём придут названия улиц и районов. */
  language?: 'az' | 'ru' | 'en'
  /**
   * Строка опознания для Nominatim.
   *
   * ⚠️ В приложении обязательна: на `okhttp/4.x` Nominatim отвечает `403`, и
   * тогда не работает НИ ОДИН запрос. В браузере задавать нельзя — заголовок
   * запрещённый, `fetch` его молча выбросит.
   */
  userAgent?: string
  /** Подмена `fetch` — только для тестов. */
  fetch?: typeof globalThis.fetch
}

/** Сколько вариантов показывать. Больше пяти в список формы не влезает. */
const LIMIT = 5

/** Сколько ждать ответа. Геокодер иногда думает долго, а форма — нет. */
const TIMEOUT_MS = 8000

const MAPBOX_FORWARD = 'https://api.mapbox.com/search/geocode/v6/forward'
const MAPBOX_REVERSE = 'https://api.mapbox.com/search/geocode/v6/reverse'
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

/**
 * Чистка ответа справочника перед показом.
 *
 * ⚠️ Строка попадает в поле формы, уходит в базу и потом рисуется на странице
 * объявления. Справочник — сторонняя служба, доверять её выводу нельзя. Было
 * на сайте в `location-picker.tsx`; поднято сюда, потому что в приложении той
 * же защиты не было вовсе.
 */
export function sanitizePlaceLabel(input: unknown): string {
  if (typeof input !== 'string') return ''

  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 255)
}

/** Координата годна, только если это число и оно в пределах Земли. */
function point(lat: unknown, lng: unknown): {lat: number; lng: number} | null {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return {lat: Number(a.toFixed(6)), lng: Number(b.toFixed(6))}
}

async function request(
  url: string,
  options: GeocodeOptions
): Promise<unknown | null> {
  const call = options.fetch ?? globalThis.fetch
  if (!call) return null

  // Своя отмена по времени, а не `AbortSignal.timeout`: последнего нет в
  // Hermes, и приложение падало бы на вызове, которого не видно в типах.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'Accept-Language': options.language ?? 'az'
    }
    if (options.userAgent) headers['User-Agent'] = options.userAgent

    const response = await call(url, {headers, signal: controller.signal})
    if (!response.ok) return null
    return (await response.json()) as unknown
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface MapboxFeature {
  properties?: {
    full_address?: unknown
    name?: unknown
    place_formatted?: unknown
    coordinates?: {longitude?: unknown; latitude?: unknown}
  }
  geometry?: {coordinates?: unknown}
}

/**
 * Разбор ответа Mapbox.
 *
 * Подпись берём `full_address` — он содержит и дом, и улицу, и район. Если
 * его нет (так бывает у городов и районов), склеиваем из названия и округи.
 *
 * Координаты — из `properties.coordinates`, а `geometry` запасной: у адресов
 * первый указывает на сам дом, второй иногда на середину участка.
 */
function fromMapbox(body: unknown): Place[] {
  const features = (body as {features?: unknown})?.features
  if (!Array.isArray(features)) return []

  const places: Place[] = []

  for (const raw of features as MapboxFeature[]) {
    const properties = raw?.properties ?? {}

    const full = sanitizePlaceLabel(properties.full_address)
    const label =
      full ||
      [sanitizePlaceLabel(properties.name), sanitizePlaceLabel(properties.place_formatted)]
        .filter(Boolean)
        .join(', ')
    if (!label) continue

    const pair = Array.isArray(raw?.geometry?.coordinates) ? raw.geometry?.coordinates : undefined
    const found =
      point(properties.coordinates?.latitude, properties.coordinates?.longitude) ??
      point((pair as unknown[])?.[1], (pair as unknown[])?.[0])
    if (!found) continue

    places.push({label, ...found})
  }

  return places
}

function fromNominatim(body: unknown): Place[] {
  if (!Array.isArray(body)) return []

  const places: Place[] = []

  for (const raw of body as Array<{display_name?: unknown; lat?: unknown; lon?: unknown}>) {
    const label = sanitizePlaceLabel(raw?.display_name)
    const found = point(raw?.lat, raw?.lon)
    if (label && found) places.push({label, ...found})
  }

  return places
}

/**
 * Поиск места по тому, что написал человек.
 *
 * Пустой список означает «не нашлось» — и это честный ответ, в отличие от
 * прежнего поведения, когда при неудаче подставлялся центр Баку и объявление
 * из посёлка молча оказывалось в столице.
 *
 * ⚠️ Отдаём СПИСОК, а не один ответ. Раньше брали `[0]` молча — так и
 * появлялся «Xetai Fitness» вместо района Хətai. Выбор за человеком: он
 * единственный знает, какой из похожих адресов его.
 */
export async function searchPlaces(query: string, options: GeocodeOptions = {}): Promise<Place[]> {
  const asked = query.trim()
  if (!asked) return []

  // ⚠️ Приведение к официальному написанию обязательно для Nominatim: на
  // «Gebele» он отдаёт улицу в БАКУ, а не город Qəbələ. Mapbox понимает и так,
  // но вреда от приведения нет, а забыть его на одном из шести вызовов —
  // можно. Поэтому здесь, а не у вызывающих.
  const resolved = resolveCityQuery(asked)
  const language = options.language ?? 'az'

  if (options.mapboxToken) {
    const url =
      `${MAPBOX_FORWARD}?q=${encodeURIComponent(resolved)}` +
      `&country=az&limit=${LIMIT}&language=${language}&permanent=true` +
      `&access_token=${encodeURIComponent(options.mapboxToken)}`

    const found = fromMapbox(await request(url, options))

    // ⚠️ На пустой ответ Mapbox к Nominatim НЕ скатываемся. Если Mapbox не
    // нашёл, то OSM тем более не найдёт, а лишний запрос только задержал бы
    // ответ человеку на несколько секунд.
    return found
  }

  const url =
    `${NOMINATIM_SEARCH}?format=json&limit=${LIMIT}&countrycodes=az` +
    `&q=${encodeURIComponent(resolved)}`

  return fromNominatim(await request(url, options))
}

/**
 * Адрес по точке, поставленной пальцем на карте.
 *
 * Пустая строка означает «не вышло». Вызывающий обязан в этом случае оставить
 * то, что человек написал сам: затирать введённое молчаливой неудачей нельзя.
 */
export async function describePoint(
  lat: number,
  lng: number,
  options: GeocodeOptions = {}
): Promise<string> {
  const found = point(lat, lng)
  if (!found) return ''

  const language = options.language ?? 'az'

  if (options.mapboxToken) {
    const url =
      `${MAPBOX_REVERSE}?longitude=${found.lng}&latitude=${found.lat}` +
      `&language=${language}&permanent=true` +
      `&access_token=${encodeURIComponent(options.mapboxToken)}`

    return fromMapbox(await request(url, options))[0]?.label ?? ''
  }

  const url = `${NOMINATIM_REVERSE}?format=json&zoom=18&lat=${found.lat}&lon=${found.lng}`
  const body = (await request(url, options)) as {display_name?: unknown} | null

  return sanitizePlaceLabel(body?.display_name)
}
