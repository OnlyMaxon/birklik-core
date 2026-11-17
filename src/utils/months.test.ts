import {describe, expect, it} from 'vitest'
import {bakuMonth} from './months'

describe('bakuMonth', () => {
  it('берёт месяц по бакинскому времени, а не по UTC', () => {
    // 30 ноября 22:00 UTC — это уже 1 декабря 02:00 в Баку. Счётчик оплат на
    // сервере считает так же, и отчёт обязан с ним совпасть.
    expect(bakuMonth('2026-11-30T22:00:00.000Z')).toBe('2026-12')
  })

  it('не перебрасывает месяц раньше срока', () => {
    expect(bakuMonth('2026-11-30T19:59:59.000Z')).toBe('2026-11')
  })

  it('дополняет номер месяца нулём', () => {
    expect(bakuMonth('2026-02-10T08:00:00.000Z')).toBe('2026-02')
  })

  it('принимает Date наравне со строкой', () => {
    expect(bakuMonth(new Date('2026-07-15T10:00:00.000Z'))).toBe('2026-07')
  })

  it('отдаёт null, когда даты нет', () => {
    // В боевой базе есть профили без createdAt. Подменять их текущим месяцем
    // нельзя: отчёт тихо приписал бы человека к чужому месяцу.
    expect(bakuMonth(undefined)).toBeNull()
    expect(bakuMonth('')).toBeNull()
  })

  it('отдаёт null на нечитаемой дате', () => {
    expect(bakuMonth('позавчера')).toBeNull()
  })
})
