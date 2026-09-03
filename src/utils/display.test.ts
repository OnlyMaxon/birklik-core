import {describe, expect, it, vi, afterEach} from 'vitest'
import {isOnDisplay} from './display'
import type {Property} from '../types'

type Displayable = Pick<Property, 'status' | 'listingTier' | 'premiumExpiresAt' | 'vipExpiresAt'>

const listing = (over: Partial<Displayable> = {}): Displayable => ({
  status: 'active',
  listingTier: 'standard',
  ...over
})

afterEach(() => {
  vi.useRealTimers()
})

function at(date: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(date))
}

describe('isOnDisplay', () => {
  it('обычное активное объявление показывается', () => {
    expect(isOnDisplay(listing())).toBe(true)
  })

  it('обычный тариф не истекает никогда', () => {
    at('2030-01-01T00:00:00Z')
    expect(isOnDisplay(listing({listingTier: 'standard'}))).toBe(true)
  })

  it('снятое с публикации не показывается', () => {
    expect(isOnDisplay(listing({status: 'inactive'}))).toBe(false)
  })

  it('черновик не показывается', () => {
    expect(isOnDisplay(listing({status: 'draft'}))).toBe(false)
  })

  it('ожидающее модерации не показывается', () => {
    expect(isOnDisplay(listing({status: 'pending'}))).toBe(false)
  })

  it('премиум с действующим сроком показывается', () => {
    at('2026-09-03T12:00:00Z')
    expect(isOnDisplay(listing({listingTier: 'premium', premiumExpiresAt: '2026-10-01'}))).toBe(true)
  })

  // Ради этого функция и существует: статус ещё active, потому что ночная
  // функция не отработала, но срок уже кончился.
  it('премиум с истёкшим сроком НЕ показывается, хотя статус ещё active', () => {
    at('2026-09-03T12:00:00Z')
    expect(isOnDisplay(listing({listingTier: 'premium', premiumExpiresAt: '2026-09-01'}))).toBe(false)
  })

  it('VIP с истёкшим сроком НЕ показывается', () => {
    at('2026-09-03T12:00:00Z')
    expect(isOnDisplay(listing({listingTier: 'vip', vipExpiresAt: '2026-09-02'}))).toBe(false)
  })

  it('платный тариф без даты вообще НЕ показывается', () => {
    expect(isOnDisplay(listing({listingTier: 'premium'}))).toBe(false)
  })

  it('дата действует до конца своих суток', () => {
    at('2026-09-03T23:00:00Z')
    expect(isOnDisplay(listing({listingTier: 'premium', premiumExpiresAt: '2026-09-03'}))).toBe(true)
  })
})
