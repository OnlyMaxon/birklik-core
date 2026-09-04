import {describe, expect, it} from 'vitest'
import {basemap} from './basemap'

const KEY = 'test_key_123'

describe('basemap', () => {
  it('без ключа отдаёт OpenStreetMap', () => {
    const map = basemap()
    expect(map.usingCarto).toBe(false)
    expect(map.url).toContain('tile.openstreetmap.org')
    expect(map.url).not.toContain('key=')
  })

  it('пустая строка и пробелы считаются отсутствием ключа', () => {
    expect(basemap('').usingCarto).toBe(false)
    expect(basemap('   ').usingCarto).toBe(false)
  })

  it('с ключом отдаёт CARTO и подставляет ключ', () => {
    const map = basemap(KEY)
    expect(map.usingCarto).toBe(true)
    expect(map.url).toContain('basemaps.cartocdn.com')
    expect(map.url).toContain(`key=${KEY}`)
  })

  // Leaflet подставляет {r} сам; у MapLibre такого механизма нет, и оставленная
  // фигурная скобка ушла бы в адрес как есть — тайлы просто не загрузились бы.
  it('плейсхолдер retina добавляется только когда его просят', () => {
    expect(basemap(KEY, true).url).toContain('{y}{r}.png')
    expect(basemap(KEY, false).url).toContain('{y}.png')
    expect(basemap(KEY, false).url).not.toContain('{r}')
  })

  it('обязательные заполнители тайла на месте в обоих вариантах', () => {
    for (const map of [basemap(), basemap(KEY)]) {
      for (const token of ['{z}', '{x}', '{y}']) {
        expect(map.url).toContain(token)
      }
    }
  })

  it('подпись CARTO появляется только вместе с их тайлами', () => {
    expect(basemap(KEY).attributionText).toContain('CARTO')
    expect(basemap().attributionText).not.toContain('CARTO')
  })
})
