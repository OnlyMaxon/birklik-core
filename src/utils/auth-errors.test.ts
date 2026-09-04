import {describe, expect, it} from 'vitest'
import {authErrorMessage, KNOWN_AUTH_ERROR_CODES} from './auth-errors'
import type {Language} from '../types'

const LANGUAGES: Language[] = ['az', 'en', 'ru']

describe('authErrorMessage', () => {
  it('у каждого известного кода есть текст на всех трёх языках', () => {
    for (const code of KNOWN_AUTH_ERROR_CODES) {
      for (const language of LANGUAGES) {
        const message = authErrorMessage(code, language)
        expect(message, `${code} / ${language}`).toBeTruthy()
      }
    }
  })

  it('незнакомый код возвращает null, а не выдуманный текст', () => {
    expect(authErrorMessage('auth/something-new', 'ru')).toBeNull()
  })

  it('пустой код возвращает null', () => {
    expect(authErrorMessage('', 'az')).toBeNull()
  })

  // Firebase перестал различать «нет такого пользователя» и «неверный пароль»,
  // чтобы не подсказывать подбирающему, какие адреса зарегистрированы. Старые
  // коды всё ещё встречаются и должны давать тот же текст.
  it('устаревшие коды сводятся к invalid-credential', () => {
    const expected = authErrorMessage('auth/invalid-credential', 'ru')
    expect(authErrorMessage('auth/wrong-password', 'ru')).toBe(expected)
    expect(authErrorMessage('auth/user-not-found', 'ru')).toBe(expected)
  })

  it('язык действительно меняет текст', () => {
    const az = authErrorMessage('auth/invalid-email', 'az')
    const ru = authErrorMessage('auth/invalid-email', 'ru')
    const en = authErrorMessage('auth/invalid-email', 'en')
    expect(new Set([az, ru, en]).size).toBe(3)
  })
})
