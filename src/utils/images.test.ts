import {describe, expect, it} from 'vitest'
import {imageUrlFromStoragePath, storagePathFromImageSource, toImageApiUrl} from './images'

const SITE = 'https://birklik.az'
const PATH = 'properties/user-1/photo.webp'

describe('storagePathFromImageSource', () => {
  it('разбирает путь через прокси', () => {
    expect(storagePathFromImageSource('/api/images/properties/user-1/photo.webp')).toBe(PATH)
  })

  it('разбирает прямую ссылку на Firebase Storage', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/birklik-65289.firebasestorage.app/o/'
      + encodeURIComponent(PATH) + '?alt=media&token=abc'
    expect(storagePathFromImageSource(url)).toBe(PATH)
  })

  it('разбирает gs://', () => {
    expect(storagePathFromImageSource(`gs://birklik-65289.appspot.com/${PATH}`)).toBe(PATH)
  })

  it('возвращает пробелы в имени файла как есть', () => {
    // В боевой базе такие есть: «WhatsApp Image 2026-08-26 at 11.50.13.webp».
    const name = 'properties/user-1/WhatsApp Image 2026-08-26 at 11.50.13.webp'
    const encoded = name.split('/').map(encodeURIComponent).join('/')
    expect(storagePathFromImageSource(`/api/images/${encoded}`)).toBe(name)
  })

  it('отказывает на чужой папке', () => {
    expect(storagePathFromImageSource('/api/images/secrets/key.txt')).toBeNull()
  })

  it('отказывает на выходе вверх по дереву', () => {
    expect(storagePathFromImageSource('/api/images/properties/..%2F..%2Fetc')).toBeNull()
  })
})

describe('imageUrlFromStoragePath', () => {
  it('без origin даёт относительный путь — так ходит сайт', () => {
    expect(imageUrlFromStoragePath(PATH)).toBe('/api/images/properties/user-1/photo.webp')
  })

  it('с origin даёт полный адрес — это нужно приложению', () => {
    expect(imageUrlFromStoragePath(PATH, SITE))
      .toBe('https://birklik.az/api/images/properties/user-1/photo.webp')
  })

  it('не пускает путь вне разрешённых папок', () => {
    expect(() => imageUrlFromStoragePath('secrets/key.txt')).toThrow()
  })
})

describe('toImageApiUrl', () => {
  it('приводит старую прямую ссылку к прокси приложения', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/birklik-65289.firebasestorage.app/o/'
      + encodeURIComponent(PATH) + '?alt=media&token=abc'
    expect(toImageApiUrl(url, SITE)).toBe(`${SITE}/api/images/properties/user-1/photo.webp`)
  })

  it('уже готовый путь получает недостающий домен', () => {
    // Ровно тот случай, из-за которого в приложении были серые прямоугольники.
    expect(toImageApiUrl('/api/images/properties/user-1/photo.webp', SITE))
      .toBe(`${SITE}/api/images/properties/user-1/photo.webp`)
  })

  it('чужой домен остаётся нетронутым', () => {
    // Заглушки аватаров с ui-avatars.com — ломать их незачем.
    const avatar = 'https://ui-avatars.com/api/?name=Guest'
    expect(toImageApiUrl(avatar, SITE)).toBe(avatar)
  })

  it('пустое значение проходит насквозь', () => {
    expect(toImageApiUrl(undefined, SITE)).toBeUndefined()
    expect(toImageApiUrl('', SITE)).toBe('')
  })
})
