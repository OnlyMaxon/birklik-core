/**
 * Разбор адресов картинок, сложившихся в базе за время жизни площадки.
 *
 * В боевых записях лежит смесь: свежие — путём через прокси `/api/images/...`,
 * старые — прямыми ссылками на Firebase Storage (`firebasestorage.googleapis.com`,
 * `storage.googleapis.com`, `gs://`). Все они приводятся к одному виду.
 *
 * ⚠️ Путь через прокси **относительный**, и это осознанно: сайт живёт на одном
 * домене с ним. Приложению же достраивать его нечем — Glide на Android падает с
 * `Expected URL scheme 'http' or 'https' but no scheme was found`, и вместо
 * фотографий выходят серые прямоугольники. Поэтому здесь есть `origin`: сайт его
 * не передаёт и получает прежний относительный путь, приложение передаёт
 * `https://birklik.az`.
 */

const IMAGE_API_PREFIX = '/api/images/'
const ALLOWED_STORAGE_PREFIXES = ['properties/', 'avatars/'] as const

function isAllowedStoragePath(path: string): boolean {
  const segments = path.split('/')
  return (
    ALLOWED_STORAGE_PREFIXES.some(prefix => path.startsWith(prefix)) &&
    segments.every(segment => segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\0'))
  )
}

function decodePath(path: string): string | null {
  try {
    return path
      .split('/')
      .map(segment => decodeURIComponent(segment))
      .join('/')
  } catch {
    return null
  }
}

/** Разбор адреса прокси `/api/images/...` — и относительного, и полного. */
function pathFromImageApi(pathname: string): string | null {
  const encodedPath = pathname.slice(IMAGE_API_PREFIX.length).split(/[?#]/, 1)[0]
  const path = decodePath(encodedPath)
  return path && isAllowedStoragePath(path) ? path : null
}

/** Return the Firebase Storage object path represented by an app or legacy URL. */
export function storagePathFromImageSource(source: string): string | null {
  if (!source) return null

  if (source.startsWith(IMAGE_API_PREFIX)) {
    return pathFromImageApi(source)
  }

  if (source.startsWith('gs://')) {
    const firstSlash = source.indexOf('/', 'gs://'.length)
    const path = firstSlash === -1 ? '' : source.slice(firstSlash + 1)
    return isAllowedStoragePath(path) ? path : null
  }

  try {
    const url = new URL(source)

    // ⚠️ ПОЛНЫЙ адрес прокси — `https://birklik.az/api/images/...`. Его строит
    // САМО приложение: `imageUrlFromStoragePath` получает от него `origin`,
    // потому что относительному пути в React Native не от чего отсчитываться.
    // При правке объявления показанные адреса сохраняются обратно в документ.
    //
    // Разбора у этого вида не было, и ветку `catch` он тоже не задевал: `new URL`
    // на нём отрабатывает успешно. Возвращался `null` — а удаление объявления
    // молча пропускает всё, что не разобралось. Найдено 2026-09-26: после
    // удаления объявления, которое правили с телефона, в хранилище остались ВСЕ
    // пять снимков. Второе объявление, поданное и удалённое без правки,
    // подчистилось начисто — потому и выглядело исправным.
    //
    // Хост намеренно не сверяется: за прокси стоит собственное хранилище, и
    // отдать он может только `properties/` и `avatars/` — это проверяет
    // `isAllowedStoragePath`. Сверка с birklik.az сломала бы предпросмотр и
    // любой домен, кроме боевого.
    if (url.pathname.startsWith(IMAGE_API_PREFIX)) {
      return pathFromImageApi(url.pathname + url.search)
    }

    if (url.hostname === 'firebasestorage.googleapis.com') {
      const objectMarker = '/o/'
      const markerIndex = url.pathname.indexOf(objectMarker)
      if (markerIndex === -1) return null
      const path = decodeURIComponent(url.pathname.slice(markerIndex + objectMarker.length))
      return isAllowedStoragePath(path) ? path : null
    }

    if (url.hostname === 'storage.googleapis.com') {
      const pathParts = url.pathname.split('/').filter(Boolean)
      const path = decodePath(pathParts.slice(1).join('/'))
      return path && isAllowedStoragePath(path) ? path : null
    }
  } catch {
    // A plain Storage object path is also accepted by deletion helpers.
    return isAllowedStoragePath(source) ? source : null
  }

  return null
}

/**
 * Адрес картинки через прокси.
 *
 * @param origin без него получается относительный путь — так ходит сайт.
 *   Приложению нужен полный: у него нет страницы, от которой отсчитывать.
 */
export function imageUrlFromStoragePath(path: string, origin = ''): string {
  if (!isAllowedStoragePath(path)) {
    throw new Error('Unsupported image storage path')
  }

  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${origin}${IMAGE_API_PREFIX}${encoded}`
}

/**
 * Нарисованная на стороне заглушка аватара.
 *
 * ⚠️ Раньше и сайт, и приложение подставляли вместо пустого аватара картинку с
 * `ui-avatars.com`, передавая в адресе НАСТОЯЩЕЕ ИМЯ человека:
 * `?name=JALIL%20ORUJLI`. Имена всех пользователей уходили на чужой сервер при
 * каждой отрисовке, а договора обработки с ним нет. Для анкеты Google Play это
 * передача личных данных третьим лицам.
 *
 * Выдавать такие адреса перестали, но в базе они остались — у всех, кто
 * зарегистрировался раньше, и внутри старых комментариев. Поэтому здесь
 * проверка: такой адрес считается ОТСУТСТВИЕМ аватара, и вместо него рисуются
 * инициалы. Чистить базу не обязательно — незапрошенный адрес никуда не уходит.
 */
export function isPlaceholderAvatar(source: string | undefined): boolean {
  return typeof source === 'string' && source.includes('ui-avatars.com')
}

/**
 * Hide legacy Firebase URLs behind the image API.
 *
 * Адрес, который разобрать не удалось, возвращается как есть: в базе попадаются
 * ссылки на чужие домены, и ломать их незачем. Исключение одно — заглушки
 * аватаров: они отдаются как «аватара нет», см. isPlaceholderAvatar.
 */
export function toImageApiUrl(source: string | undefined, origin = ''): string | undefined {
  if (!source) return source
  if (isPlaceholderAvatar(source)) return undefined
  const path = storagePathFromImageSource(source)
  return path ? imageUrlFromStoragePath(path, origin) : source
}
