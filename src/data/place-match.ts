/**
 * Сопоставление написаний географических названий.
 *
 * Задача: «Gebele», «Qəbələ», «Gabala» и «Габала» — один и тот же город, и
 * пользователь вправе набрать любое из них. Таких расхождений в Азербайджане
 * много, и списком синонимов их не закрыть: он держится на том, что кто-то
 * заранее вспомнил каждое написание.
 *
 * Поэтому здесь два уровня, и порядок между ними важен:
 *
 *  1. `foldPlace` — свёртка написания к одному виду. Снимает всё, что является
 *     РАЗНИЦЕЙ ПИСЬМА, а не разницей названия: азербайджанские буквы (ə, ı, ğ,
 *     ş, ç, ö, ü), кириллицу, английские двузнаки (sh, ch, kh), чередование
 *     q/g и x/h. Правило детерминированное — ничего угадывать не нужно.
 *
 *  2. `CITY_ALIASES` в [[city-aliases]] — остаётся только для случаев, где
 *     названия РАЗНЫЕ, а не написаны по-разному: Bakı против Baku, Gəncə
 *     против Ganja. Свёртка их не сведёт и не должна.
 *
 * ⚠️ Свёртка применяется к ОБЕИМ сторонам сравнения — и к запросу, и к каждому
 * написанию из справочника. Отсюда главное свойство: любое написание, которое
 * уже есть в `cities` (значение, az, en, ru), находится всегда, а свёртка
 * добавляет к нему разумные отклонения. Сравнивать запрос с одним лишь
 * «официальным» названием было бы заметно слабее.
 *
 * ⚠️ Namely `String.prototype.normalize` здесь НЕ используется: пакет общий с
 * приложением на React Native, а в Hermes нормализация зависит от сборки с
 * Intl. Все замены заданы таблицей явно — так одинаково работает везде.
 */

/** Кириллица → латиница. Настроено на азербайджанские топонимы, не на русский вообще. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'o', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'c', ч: 'c', ш: 's', щ: 's',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'u', я: 'a',
  // Азербайджанская кириллица — встречается в старых записях.
  ә: 'e', ҝ: 'g', ғ: 'g', ј: 'y', һ: 'h', ө: 'o', ү: 'u', ҹ: 'c'
}

/**
 * Буквы с надстрочными знаками и азербайджанские особые.
 *
 * ⚠️ `ı` и `ə` разложению не поддаются вовсе — только таблицей. А `İ` после
 * `toLowerCase()` превращается в `i` + отдельный знак точки (U+0307), поэтому
 * сочетающиеся знаки ниже снимаются отдельным правилом.
 */
const LETTER_TO_ASCII: Record<string, string> = {
  ə: 'e', ı: 'i',
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  ç: 'c', ć: 'c',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  ğ: 'g',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ñ: 'n',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o',
  ş: 's', ś: 's', š: 's',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y',
  ź: 'z', ż: 'z', ž: 'z'
}

/**
 * Двузнаки английской передачи. Порядок существенен: `kh` обязан сработать
 * раньше, чем одиночное `h`, иначе «Khachmaz» не сойдётся с «Xaçmaz».
 */
const DIGRAPHS: Array<[RegExp, string]> = [
  [/kh/g, 'x'],
  [/gh/g, 'g'],
  [/sh/g, 's'],
  [/ch/g, 'c'],
  [/zh/g, 'j'],
  [/dj/g, 'c'],
  [/ts/g, 'c'],
  [/ph/g, 'f'],
  [/ck/g, 'k']
]

/**
 * Приводит написание места к сравнимому виду.
 *
 * Пустую строку возвращает для всего, в чём не осталось букв и цифр.
 */
export function foldPlace(value: string): string {
  if (!value) return ''

  let out = ''
  for (const char of value.toLowerCase()) {
    const cyrillic = CYRILLIC_TO_LATIN[char]
    if (cyrillic !== undefined) { out += cyrillic; continue }
    const ascii = LETTER_TO_ASCII[char]
    out += ascii !== undefined ? ascii : char
  }

  // Сочетающиеся знаки — в том числе точка над `i`, оставшаяся от `İ`.
  out = out.replace(/[̀-ͯ]/g, '')

  for (const [pattern, replacement] of DIGRAPHS) out = out.replace(pattern, replacement)

  // Чередования, устойчивые именно в азербайджанских названиях: `q` в
  // английской передаче почти всегда становится `g` (Qax → Gax, Quba → Guba),
  // а `x` читается как `h` (Xaçmaz → Khachmaz).
  out = out.replace(/q/g, 'g').replace(/x/g, 'h').replace(/w/g, 'v')

  // Всё, что не буква и не цифра, — разделитель: дефисы, апострофы, точки.
  out = out.replace(/[^a-z0-9]+/g, ' ').trim()

  return out
}

/** Расстояние Дамерау — Левенштейна, оборванное по `limit` ради скорости. */
function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limit) return limit + 1

  let previous = Array.from({length: b.length + 1}, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      // Перестановка соседних букв: «Gancə» против «Gacnə» — одна ошибка.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previous[j - 2] + 1)
      }
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > limit) return limit + 1
    previous = current
  }

  return previous[b.length]
}

/**
 * Насколько запрос допускает опечатку.
 *
 * Коротким названиям не прощается ничего: у «Qax» и «Qusar» одна замена буквы
 * уже уводит в другой город. Порог измерен по справочнику — см.
 * `place-match.test.ts`, там это закреплено проверкой на столкновения.
 */
function typoBudget(length: number): number {
  if (length >= 8) return 2
  if (length >= 5) return 1
  return 0
}

/** Насколько хорошо запрос попал в написание: 0 — мимо, больше — точнее. */
export function placeMatchScore(name: string, query: string, allowTypos = true): number {
  const foldedName = foldPlace(name)
  const foldedQuery = foldPlace(query)
  if (!foldedName || !foldedQuery) return 0

  if (foldedName === foldedQuery) return 4
  if (foldedName.startsWith(foldedQuery)) return 3
  if (foldedQuery.length >= 3 && foldedName.includes(foldedQuery)) return 2

  if (allowTypos) {
    const budget = typoBudget(Math.min(foldedName.length, foldedQuery.length))
    if (budget > 0 && editDistance(foldedName, foldedQuery, budget) <= budget) return 1
  }

  return 0
}

/**
 * Совпало ли написание с запросом.
 *
 * `allowTypos` по умолчанию выключен: у отбора объявлений цена ошибки выше,
 * чем у подсказки. В списке подсказок человек видит, что ему предложили, и
 * выбирает сам; в отборе он видит только результат и принимает его за истину.
 */
export function placeMatches(name: string, query: string, allowTypos = false): boolean {
  return placeMatchScore(name, query, allowTypos) > 0
}
