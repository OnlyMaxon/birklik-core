import {describe, expect, it} from 'vitest'
import {cities, cityByAnySpelling, resolveCityQuery} from './properties'
import {foldPlace, placeMatchScore, placeMatches} from './place-match'

const spellings = (city: typeof cities[number]) => [city.value, city.az, city.en, city.ru]

const bestScore = (query: string, allowTypos: boolean) =>
  cities
    .map(city => ({
      city: city.value,
      score: Math.max(...spellings(city).map(name => placeMatchScore(name, query, allowTypos)))
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)

describe('foldPlace: разное написание одного названия', () => {
  // Здесь и ниже проверяется именно то, о чём спрашивали: человек набирает
  // «Gebele», а в справочнике «Qəbələ». Списком синонимов такое закрывается
  // только до первого написания, о котором никто не вспомнил.
  it('азербайджанские буквы приводятся к латинице', () => {
    expect(foldPlace('Qəbələ')).toBe('gebele')
    expect(foldPlace('Şəki')).toBe('seki')
    expect(foldPlace('Bakı')).toBe('baki')
    expect(foldPlace('Göyçay')).toBe('goycay')
    expect(foldPlace('Ağdam')).toBe('agdam')
  })

  it('кириллица приводится к той же латинице', () => {
    expect(foldPlace('Баку')).toBe(foldPlace('Baku'))
    expect(foldPlace('Габала')).toBe(foldPlace('Gabala'))
    expect(foldPlace('Шеки')).toBe(foldPlace('Sheki'))
    expect(foldPlace('Закатала')).toBe(foldPlace('Zakatala'))
  })

  // ⚠️ Свёртка НЕ обязана сводить всё ко всему, и на это важно не рассчитывать:
  // «Закатала» и «Zaqatala» расходятся в согласной (k против g), «Гянджа» и
  // «Ganja» — тоже. Такие пары находятся не свёрткой, а тем, что оба написания
  // уже лежат в справочнике рядом и сворачивается КАЖДОЕ из них.
  it('расхождение в согласной свёрткой не лечится — его закрывает справочник', () => {
    expect(foldPlace('Закатала')).not.toBe(foldPlace('Zaqatala'))
    expect(bestScore('Закатала', false)[0]?.city).toBe('Zaqatala')

    expect(foldPlace('Гянджа')).not.toBe(foldPlace('Ganja'))
    expect(bestScore('Гянджа', false)[0]?.city).toBe('Ganja')
  })

  it('английские двузнаки сводятся к азербайджанским буквам', () => {
    expect(foldPlace('Khachmaz')).toBe(foldPlace('Xaçmaz'))
    expect(foldPlace('Shusha')).toBe(foldPlace('Şuşa'))
    expect(foldPlace('Nakhchivan')).toBe(foldPlace('Naxçıvan'))
  })

  // ⚠️ `İ` в нижнем регистре даёт `i` и ОТДЕЛЬНЫЙ знак точки сверху. Без его
  // снятия «İsmayıllı» и «Ismayilli» остались бы разными строками.
  it('прописная İ не тащит за собой знак точки', () => {
    expect(foldPlace('İsmayıllı')).toBe('ismayilli')
    expect(foldPlace('İmişli')).toBe('imisli')
  })

  it('пустое и бессодержательное сворачивается в пустую строку', () => {
    expect(foldPlace('')).toBe('')
    expect(foldPlace('  —  ')).toBe('')
  })
})

describe('placeMatchScore: запрос находит нужный город', () => {
  const findsExactly = (query: string, expected: string) => {
    const hits = bestScore(query, true)
    expect(hits.length, `«${query}» не нашёл ничего`).toBeGreaterThan(0)
    expect(hits[0].city, `«${query}» → ${hits.map(h => h.city).join(', ')}`).toBe(expected)
  }

  it('находит по любому из четырёх написаний справочника', () => {
    for (const city of cities) {
      for (const spelling of spellings(city)) {
        expect(placeMatchScore(spelling, spelling), `${city.value}: ${spelling}`).toBe(4)
      }
    }
  })

  it('находит написания, которых в справочнике нет', () => {
    findsExactly('Gebele', 'Gabala')
    findsExactly('Qabala', 'Gabala')
    findsExactly('Sumgait', 'Sumgayit')
    findsExactly('Zakatala', 'Zaqatala')
    findsExactly('Lenkoran', 'Lankaran')
    findsExactly('Guba', 'Quba')
    findsExactly('Mingechevir', 'Mingachevir')
    findsExactly('Ismailli', 'Ismayilli')
  })

  it('находит по началу слова — подсказка нужна до конца набора', () => {
    expect(placeMatchScore('Qəbələ', 'Qeb')).toBe(3)
    expect(placeMatchScore('Bakı', 'bak')).toBe(3)
  })

  it('прощает одну опечатку в длинном названии', () => {
    expect(placeMatchScore('Ağdam', 'Ахдам', true)).toBeGreaterThan(0)
    expect(placeMatchScore('Naxçıvan', 'Нахичевань', true)).toBeGreaterThan(0)
  })

  // Короткое название одной заменой буквы превращается в соседний город,
  // поэтому запас на опечатку ему не даётся вовсе.
  it('не прощает опечатку в коротком названии', () => {
    expect(placeMatchScore('Qax', 'Qaz', true)).toBe(0)
    expect(placeMatchScore('Quba', 'Guma', true)).toBe(0)
  })

  it('по умолчанию опечатки НЕ прощаются', () => {
    expect(placeMatches('Ağdam', 'Ахдам')).toBe(false)
    expect(placeMatches('Ağdam', 'Ахдам', true)).toBe(true)
  })

  it('чужой город не находится', () => {
    expect(placeMatches('Bakı', 'Gəncə')).toBe(false)
    expect(placeMatches('Bakı', 'Гянджа')).toBe(false)
  })
})

// ⚠️ Эта проверка сторожит не код, а САМ СПРАВОЧНИК. Она уже поймала три
// ошибки в русских названиях: у Hacıqabul и Xaçmaz стояло одно и то же
// «Хачмас», у Göyçay — «Геий-Чай», у Biləsuvar — «Бильджасувар». Пока
// сравнение шло по точному совпадению строк, такие пары ничем себя не выдавали.
describe('справочник городов: написания не сталкиваются между собой', () => {
  it('ни одно написание не находит чужой город', () => {
    const collisions: string[] = []

    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        for (const left of spellings(cities[i])) {
          for (const right of spellings(cities[j])) {
            if (placeMatches(left, right)) {
              collisions.push(`${cities[i].value} «${left}» ~ ${cities[j].value} «${right}»`)
            }
          }
        }
      }
    }

    expect(collisions).toEqual([])
  })

  it('у каждого города все четыре написания непустые', () => {
    const empty = cities.filter(city => spellings(city).some(name => !foldPlace(name)))
    expect(empty.map(city => city.value)).toEqual([])
  })
})

// ⚠️ Это сторожит НЕВЕРНУЮ МЕТКУ, а не удобство. Измерено 2026-09-25: на
// «Gebele» Nominatim отвечает улицей «Qədim Qəbələ» в Xətai районе Баку —
// успешно и правдоподобно, поэтому объявление молча получало координаты в
// другом городе. На «Qəbələ» тот же геокодер отвечает верно.
describe('resolveCityQuery: приведение к официальному написанию для геокодера', () => {
  it('сводит любое написание к азербайджанскому', () => {
    expect(resolveCityQuery('Gebele')).toBe('Qəbələ')
    expect(resolveCityQuery('Gabala')).toBe('Qəbələ')
    expect(resolveCityQuery('Баку')).toBe('Bakı')
    expect(resolveCityQuery('Baku')).toBe('Bakı')
    expect(resolveCityQuery('Sumgait')).toBe('Sumqayıt')
  })

  it('заменяет город внутри запроса из нескольких слов', () => {
    expect(resolveCityQuery('Gebele rayonu')).toBe('Qəbələ rayonu')
    expect(resolveCityQuery('Yasamal, Baku')).toBe('Yasamal, Bakı')
  })

  it('не трогает то, что городом не является', () => {
    expect(resolveCityQuery('Yasamal')).toBe('Yasamal')
    expect(resolveCityQuery('Mərdəkan')).toBe('Mərdəkan')
  })

  // Опечатки здесь не прощаются намеренно: метка не на том месте хуже
  // отсутствующей, а проверить её пользователю нечем.
  it('опечатку в город не превращает', () => {
    expect(cityByAnySpelling('Ахдам')).toBeUndefined()
    expect(cityByAnySpelling('Gebelo')).toBeUndefined()
  })
})
