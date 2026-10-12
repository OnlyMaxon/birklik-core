import {describe, expect, it} from 'vitest'
import {BOOST_WINDOW_MS, boostRank, isBoostActive, listingSortTime} from './boost-helper'

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString()

describe('isBoostActive', () => {
  it('признаёт свежий подъём', () => {
    expect(isBoostActive({boostedAt: hoursAgo(1)})).toBe(true)
  })

  it('держит подъём все сутки', () => {
    expect(isBoostActive({boostedAt: hoursAgo(23)})).toBe(true)
  })

  it('гасит подъём после окна', () => {
    expect(isBoostActive({boostedAt: hoursAgo(26)})).toBe(false)
  })

  it('переживает запоздавший ночной прогон', () => {
    // Ради этого окно и сделано больше суток: задача подъёма ходит раз в день, и
    // при ровно 24 часах любая задержка планировщика роняла бы объявление из
    // полосы до следующего прогона.
    expect(BOOST_WINDOW_MS).toBeGreaterThan(24 * 3600000)
    expect(isBoostActive({boostedAt: hoursAgo(24.5)})).toBe(true)
  })

  it('считает объявление без подъёма неподнятым', () => {
    expect(isBoostActive({createdAt: hoursAgo(1)})).toBe(false)
  })

  it('не верит подъёму из будущего', () => {
    // Такую дату даёт только сбой часов или правка руками. Признав её, мы отдали
    // бы верх полосы навсегда: окно от будущего момента не истекает.
    expect(isBoostActive({boostedAt: new Date(Date.now() + 86400000).toISOString()})).toBe(false)
  })

  it('не падает на мусоре вместо даты', () => {
    expect(isBoostActive({boostedAt: 'завтра'})).toBe(false)
  })
})

describe('boostRank', () => {
  it('ставит поднятое выше неподнятого', () => {
    expect(boostRank({boostedAt: hoursAgo(1)})).toBeGreaterThan(boostRank({}))
  })
})

describe('listingSortTime', () => {
  it('сравнивает поднятое по моменту подъёма, а не по дате создания', () => {
    // Иначе ежедневный подъём не значил бы ничего: объявление стояло бы по своей
    // исходной дате, и пакет на десять дней не отличался бы от одиночного.
    const old = {createdAt: hoursAgo(1000), boostedAt: hoursAgo(1)}
    const fresh = {createdAt: hoursAgo(2)}
    expect(listingSortTime(old)).toBeGreaterThan(listingSortTime(fresh))
  })

  it('возвращает неподнятое на его дату создания', () => {
    // Выдохшийся подъём не оставляет следа в порядке — объявление встаёт туда,
    // где стояло до покупки.
    const expired = {createdAt: hoursAgo(1000), boostedAt: hoursAgo(30)}
    expect(listingSortTime(expired)).toBe(new Date(expired.createdAt).getTime())
  })

  it('сравнивает поднятые между собой по свежести подъёма', () => {
    const earlier = {createdAt: hoursAgo(10), boostedAt: hoursAgo(5)}
    const later = {createdAt: hoursAgo(1000), boostedAt: hoursAgo(2)}
    expect(listingSortTime(later)).toBeGreaterThan(listingSortTime(earlier))
  })

  it('отдаёт ноль, когда дат нет вовсе', () => {
    expect(listingSortTime({})).toBe(0)
  })
})
