import {describe, expect, it} from 'vitest'
import type {Language, Translations} from '../types'

import az from './az/app.json'
import en from './en/app.json'
import ru from './ru/app.json'

/**
 * Словари нигде не сверяются с типом `Translations`: и сайт, и приложение
 * приводят их приведением типа, а оно ничего не проверяет. Значит забытый в
 * одном языке ключ обнаружится только дырой на экране — и, скорее всего, в
 * русской или английской версии, которые смотрят реже.
 *
 * Здесь сверка настоящая: тип обязывает объект содержать все поля, а обход
 * ловит расхождения между языками.
 */

const CATALOGS: Record<Language, Translations> = {
  az: (az as {App: Translations}).App,
  en: (en as {App: Translations}).App,
  ru: (ru as {App: Translations}).App
}

const LANGUAGES: Language[] = ['az', 'en', 'ru']

/** Плоская карта путь → строка: 'auth.login', 'property.rooms', … */
function flatten(value: unknown, prefix = '', out = new Map<string, string>()): Map<string, string> {
  if (typeof value === 'string') {
    out.set(prefix, value)
    return out
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  }
  return out
}

const MAPS: Record<Language, Map<string, string>> = {
  az: flatten(CATALOGS.az),
  en: flatten(CATALOGS.en),
  ru: flatten(CATALOGS.ru)
}

describe('словари переводов', () => {
  it('во всех трёх языках одинаковый набор ключей', () => {
    const reference = [...MAPS.az.keys()].sort()

    for (const language of ['en', 'ru'] as const) {
      const actual = [...MAPS[language].keys()].sort()
      expect(
        reference.filter(key => !actual.includes(key)),
        `нет в ${language}`
      ).toEqual([])
      expect(
        actual.filter(key => !reference.includes(key)),
        `лишнее в ${language}`
      ).toEqual([])
    }
  })

  // Пустая строка сама по себе не ошибка: у завершающего абзаца страницы
  // «О нас» заголовка нет по замыслу, и он пуст во всех трёх языках.
  // Ошибка — когда строка пуста В ОДНОМ языке и заполнена в другом: значит
  // перевод забыли, а на экране будет дыра.
  it('нет строк, переведённых лишь на части языков', () => {
    const uneven: string[] = []

    for (const key of MAPS.az.keys()) {
      const emptiness = LANGUAGES.map(language => !MAPS[language].get(key)?.trim())
      if (emptiness.some(Boolean) && !emptiness.every(Boolean)) uneven.push(key)
    }

    expect(uneven, 'переведено не на всех языках').toEqual([])
  })
})
