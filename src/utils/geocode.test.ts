import {describe, expect, it, vi} from 'vitest'

import {describePoint, sanitizePlaceLabel, searchPlaces} from './geocode'

/** Отвечает заранее заготовленным телом и запоминает запрошенный адрес. */
function fakeFetch(body: unknown, ok = true) {
  const calls: string[] = []
  const call = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url))
    return {ok, json: async () => body} as Response
  })
  return {call: call as unknown as typeof globalThis.fetch, calls}
}

const MAPBOX_ADDRESS = {
  type: 'FeatureCollection',
  features: [
    {
      geometry: {type: 'Point', coordinates: [49.84, 40.38]},
      properties: {
        full_address: 'Nizami küçəsi 23, Nəsimi, Bakı, Azərbaycan',
        name: 'Nizami küçəsi 23',
        place_formatted: 'Nəsimi, Bakı',
        coordinates: {longitude: 49.845123, latitude: 40.379456}
      }
    }
  ]
}

describe('searchPlaces: выбор справочника', () => {
  it('с токеном идёт в Mapbox и просит permanent — координаты мы храним', async () => {
    const {call, calls} = fakeFetch(MAPBOX_ADDRESS)

    await searchPlaces('Nizami küçəsi 23', {mapboxToken: 'pk.test', fetch: call})

    expect(calls[0]).toContain('api.mapbox.com/search/geocode/v6/forward')
    expect(calls[0]).toContain('permanent=true')
    expect(calls[0]).toContain('country=az')
  })

  it('без токена откатывается на Nominatim, а не падает', async () => {
    const {call, calls} = fakeFetch([
      {display_name: 'Yasamal rayonu, Bakı', lat: '40.38', lon: '49.80'}
    ])

    const found = await searchPlaces('Yasamal', {fetch: call})

    expect(calls[0]).toContain('nominatim.openstreetmap.org')
    expect(found).toHaveLength(1)
  })

  it('не скатывается на Nominatim, когда Mapbox ответил пусто', async () => {
    const {call, calls} = fakeFetch({type: 'FeatureCollection', features: []})

    const found = await searchPlaces('чего-то не бывает', {mapboxToken: 'pk.test', fetch: call})

    expect(found).toEqual([])
    expect(calls).toHaveLength(1)
  })
})

describe('searchPlaces: разбор ответа', () => {
  it('берёт подпись и точку дома, а не середину участка', async () => {
    const {call} = fakeFetch(MAPBOX_ADDRESS)

    const found = await searchPlaces('Nizami 23', {mapboxToken: 'pk.test', fetch: call})

    expect(found[0]).toEqual({
      label: 'Nizami küçəsi 23, Nəsimi, Bakı, Azərbaycan',
      lat: 40.379456,
      lng: 49.845123
    })
  })

  it('без full_address склеивает подпись из названия и округи', async () => {
    const {call} = fakeFetch({
      features: [
        {
          geometry: {coordinates: [49.8, 40.4]},
          properties: {name: 'Yasamal rayonu', place_formatted: 'Bakı, Azərbaycan'}
        }
      ]
    })

    const found = await searchPlaces('Yasamal', {mapboxToken: 'pk.test', fetch: call})

    expect(found[0].label).toBe('Yasamal rayonu, Bakı, Azərbaycan')
    expect(found[0]).toMatchObject({lat: 40.4, lng: 49.8})
  })

  it('выбрасывает ответ без годных координат, а не отдаёт NaN', async () => {
    const {call} = fakeFetch({
      features: [
        {properties: {full_address: 'Где-то', coordinates: {longitude: 'нет', latitude: 'нет'}}},
        {properties: {full_address: 'Вне Земли', coordinates: {longitude: 900, latitude: 100}}},
        {properties: {full_address: 'Bakı', coordinates: {longitude: 49.8, latitude: 40.4}}}
      ]
    })

    const found = await searchPlaces('Bakı', {mapboxToken: 'pk.test', fetch: call})

    expect(found).toHaveLength(1)
    expect(found[0].label).toBe('Bakı')
  })

  it('отдаёт список целиком — выбирает человек, а не код', async () => {
    const {call} = fakeFetch({
      features: ['Bakı', 'Bakıxanov', 'Bakı Dövlət Universiteti'].map((name, i) => ({
        properties: {full_address: name, coordinates: {longitude: 49.8 + i, latitude: 40.4}}
      }))
    })

    const found = await searchPlaces('Bak', {mapboxToken: 'pk.test', fetch: call})

    expect(found.map(place => place.label)).toEqual([
      'Bakı',
      'Bakıxanov',
      'Bakı Dövlət Universiteti'
    ])
  })
})

describe('searchPlaces: отказы', () => {
  it('пустой запрос не тревожит сеть вовсе', async () => {
    const {call, calls} = fakeFetch(MAPBOX_ADDRESS)

    expect(await searchPlaces('   ', {mapboxToken: 'pk.test', fetch: call})).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('ошибка сети — это пустой список, а не исключение в форме', async () => {
    const call = vi.fn(async () => {
      throw new Error('сеть пропала')
    }) as unknown as typeof globalThis.fetch

    expect(await searchPlaces('Bakı', {mapboxToken: 'pk.test', fetch: call})).toEqual([])
  })

  it('код не 200 — тоже пустой список', async () => {
    const {call} = fakeFetch(MAPBOX_ADDRESS, false)

    expect(await searchPlaces('Bakı', {mapboxToken: 'pk.test', fetch: call})).toEqual([])
  })
})

describe('searchPlaces: приведение написания', () => {
  it('«Gebele» уходит как «Qəbələ» — иначе Nominatim отдаёт улицу в Баку', async () => {
    const {call, calls} = fakeFetch([])

    await searchPlaces('Gebele', {fetch: call})

    expect(decodeURIComponent(calls[0])).toContain('Qəbələ')
  })
})

describe('searchPlaces: опознание для Nominatim', () => {
  it('подставляет User-Agent, когда его дали, — без него Nominatim отвечает 403', async () => {
    const calls: Array<Record<string, string>> = []
    const call = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls.push((init?.headers ?? {}) as Record<string, string>)
      return {ok: true, json: async () => []} as Response
    }) as unknown as typeof globalThis.fetch

    await searchPlaces('Bakı', {fetch: call, userAgent: 'Birklik.az/1.0 (info@birklik.az)'})

    expect(calls[0]['User-Agent']).toBe('Birklik.az/1.0 (info@birklik.az)')
  })

  it('не подставляет его в браузере — заголовок там запрещённый', async () => {
    const calls: Array<Record<string, string>> = []
    const call = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls.push((init?.headers ?? {}) as Record<string, string>)
      return {ok: true, json: async () => []} as Response
    }) as unknown as typeof globalThis.fetch

    await searchPlaces('Bakı', {fetch: call})

    expect(calls[0]['User-Agent']).toBeUndefined()
  })
})

describe('describePoint: адрес по точке на карте', () => {
  it('с токеном спрашивает Mapbox и тоже просит permanent', async () => {
    const {call, calls} = fakeFetch(MAPBOX_ADDRESS)

    const address = await describePoint(40.38, 49.84, {mapboxToken: 'pk.test', fetch: call})

    expect(calls[0]).toContain('geocode/v6/reverse')
    expect(calls[0]).toContain('permanent=true')
    expect(address).toBe('Nizami küçəsi 23, Nəsimi, Bakı, Azərbaycan')
  })

  it('без токена спрашивает Nominatim', async () => {
    const {call, calls} = fakeFetch({display_name: 'Yasamal, Bakı'})

    expect(await describePoint(40.38, 49.8, {fetch: call})).toBe('Yasamal, Bakı')
    expect(calls[0]).toContain('nominatim.openstreetmap.org/reverse')
  })

  it('негодная точка не тревожит сеть', async () => {
    const {call, calls} = fakeFetch(MAPBOX_ADDRESS)

    expect(await describePoint(Number.NaN, 49.8, {mapboxToken: 'pk.test', fetch: call})).toBe('')
    expect(calls).toHaveLength(0)
  })

  it('неудача — пустая строка: написанное человеком затирать нельзя', async () => {
    const {call} = fakeFetch(null, false)

    expect(await describePoint(40.38, 49.8, {mapboxToken: 'pk.test', fetch: call})).toBe('')
  })
})

describe('sanitizePlaceLabel: ответ справочника — сторонний текст', () => {
  it('вырезает разметку, протокол javascript и обработчики событий', () => {
    expect(sanitizePlaceLabel('<b>Bakı</b>')).toBe('Bakı')
    expect(sanitizePlaceLabel('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizePlaceLabel('x onerror=alert(1)')).toBe('x alert(1)')
  })

  it('обрезает по 255 знакам и отбрасывает не строки', () => {
    expect(sanitizePlaceLabel('я'.repeat(300))).toHaveLength(255)
    expect(sanitizePlaceLabel(undefined)).toBe('')
    expect(sanitizePlaceLabel(42)).toBe('')
  })
})
