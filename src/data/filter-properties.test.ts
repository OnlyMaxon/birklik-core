import { describe, expect, it } from 'vitest'
import { filterProperties } from './properties'
import type { Property } from '../types'

const baseProperty: Property = {
  id: 'base',
  type: 'villa',
  district: 'mardakan',
  price: { daily: 250, weekly: 1500, monthly: 6000, currency: 'AZN' },
  rooms: 5,
  minGuests: 2,
  maxGuests: 8,
  area: 240,
  amenities: ['pool', 'parking', 'wifi', 'ac'],
  images: ['img.png'],
  coordinates: { lat: 40.4, lng: 49.8 },
  title: { az: 'Villa', en: 'Villa' },
  description: { az: 'Description', en: 'Description' },
  address: { az: 'Baku', en: 'Baku' },
  owner: { name: 'Owner', phone: '+994', email: 'owner@test.com' },
  city: 'Baku',
  extraFeatures: ['sauna', 'garage'],
  nearbyPlaces: ['sea', 'beach'],
  locationCategory: 'rayon',
  locationTags: ['port_baku']
}

describe('filterProperties publication filtering', () => {
  it('matches city exactly (case-insensitive)', () => {
    const result = filterProperties([baseProperty], { city: 'baku' })
    expect(result).toHaveLength(1)
  })

  it('filters by extra features from advanced section', () => {
    const result = filterProperties([baseProperty], { extraFilters: ['sauna', 'garage'] })
    expect(result).toHaveLength(1)
  })

  it('filters by nearby places from Yaxinda section', () => {
    const result = filterProperties([baseProperty], { nearbyPlaces: ['beach'] })
    expect(result).toHaveLength(1)
  })

  it('filters by location category and selected location tags', () => {
    const result = filterProperties([baseProperty], {
      locationCategory: 'rayon',
      locationTags: ['port_baku']
    })

    expect(result).toHaveLength(1)
  })

  it('does not match when required location tag is absent', () => {
    const result = filterProperties([baseProperty], {
      locationCategory: 'metro',
      locationTags: ['28_may']
    })

    expect(result).toHaveLength(0)
  })
})

// Поиск по названию города не работал НИ НА ОДНОМ языке, и это видно только на
// настоящих данных: у боевых объявлений `city` равен `Baku`, а заголовок и
// адрес — «Mərdəkan», «Şüvəlan». Слова «Baku» в тексте нет, а сравнивались
// только заголовок с адресом. Фильтр в интерфейсе при этом работал — он смотрит
// `city` напрямую, поэтому расхождение выглядело как «не понимает русский».
describe('filterProperties: поиск по названию места', () => {
  const baku: Property = {
    ...baseProperty,
    id: 'baku-1',
    city: 'Baku',
    district: 'mardakan',
    locationTags: ['mardakan'],
    // Ровно как в боевых данных: города в тексте нет.
    title: { az: 'Mərdəkan 5 otaqlı həyət evi', en: 'Mərdəkan 5 otaqlı həyət evi' },
    address: { az: 'Mərdəkan', en: 'Mərdəkan' }
  }

  it('находит по русскому названию города', () => {
    expect(filterProperties([baku], { search: 'Баку' })).toHaveLength(1)
  })

  it('находит по английскому названию города', () => {
    expect(filterProperties([baku], { search: 'Baku' })).toHaveLength(1)
  })

  it('находит по азербайджанскому названию города', () => {
    expect(filterProperties([baku], { search: 'Bakı' })).toHaveLength(1)
  })

  it('находит по метке места внутри города', () => {
    expect(filterProperties([baku], { search: 'mardakan' })).toHaveLength(1)
  })

  it('не находит чужой город', () => {
    expect(filterProperties([baku], { search: 'Гянджа' })).toHaveLength(0)
  })

  it('по-прежнему находит по тексту заголовка', () => {
    expect(filterProperties([baku], { search: 'Mərdəkan' })).toHaveLength(1)
  })

  // ⚠️ Отсюда и ниже — второй заход, 2026-09-25. Первой починки было мало: она
  // сравнивала написания посимвольно, поэтому находила только то, что кто-то
  // заранее внёс в список синонимов. Теперь сравнивается свёртка (place-match).
  it('находит по тексту заголовка без азербайджанских букв', () => {
    expect(filterProperties([baku], { search: 'Merdekan' })).toHaveLength(1)
  })

  const gabala: Property = {
    ...baseProperty,
    id: 'gabala-1',
    city: 'Gabala',
    district: '',
    locationTags: [],
    title: { az: 'Dağ evi', en: 'Mountain house' },
    address: { az: 'Qəbələ', en: 'Qəbələ' }
  }

  it('находит город написанием, которого в справочнике нет', () => {
    for (const query of ['Gebele', 'Qabala', 'Gabala', 'Габала', 'Qəbələ']) {
      expect(filterProperties([gabala], { search: query }), query).toHaveLength(1)
    }
  })

  it('находит Sumqayıt по русской передаче через и', () => {
    const sumgayit: Property = { ...baseProperty, id: 'sum-1', city: 'Sumgayit', locationTags: [] }
    expect(filterProperties([sumgayit], { search: 'Сумгаит' })).toHaveLength(1)
  })

  // Опечатки в отборе НЕ прощаются намеренно: здесь человек видит только
  // результат и принимает его за истину. Запас на опечатку даётся списку
  // подсказок, где выбор остаётся за человеком.
  it('опечатка в отборе не срабатывает', () => {
    expect(filterProperties([gabala], { search: 'Gebelo' })).toHaveLength(0)
  })

  it('запрос без букв и цифр ничего не отсеивает', () => {
    expect(filterProperties([baku, gabala], { search: '—' })).toHaveLength(2)
  })
})
