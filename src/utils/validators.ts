/**
 * Input validation utilities
 */

/**
 * Validate phone number format for Azerbaijan
 * Supports: +994501234567, 05012345678, 501234567
 * @param phone Phone number string
 * @returns true if valid Azerbaijan phone number
 */
export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '')

  // Azerbaijan phone number patterns:
  // +994XXXXXXXXXX (with +994 prefix)
  // 0XXXXXXXXXX (with 0 prefix)
  // XXXXXXXXXX (10 digits)
  const azPhoneRegex = /^(\+994|0)?[1-9]\d{1,14}$/

  return azPhoneRegex.test(cleaned) && cleaned.length >= 9
}

/**
 * Validate name format
 * @param name Name string
 * @returns true if valid name (2-100 chars, letters/spaces/hyphens only)
 */
export const validateName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false

  const cleaned = name.trim()
  // Allow letters (any language), spaces, hyphens, apostrophes
  const nameRegex = /^[\p{L}\s\-']{2,100}$/u
  return nameRegex.test(cleaned)
}

// Здесь были validateEmail и validatePassword. Убраны 2026-09-10: формы входа
// и регистрации на обеих сторонах полагаются на проверку Firebase, которая
// возвращает код ошибки (auth/invalid-email, auth/weak-password), а текст к
// нему даёт authErrorMessage. Своя проверка до отправки дублировала бы её и
// разошлась порогами — в коде стояло 8 символов, у Firebase 6.
//
// Здесь была validateFile(file: File). Убрана при выносе в общий пакет: её
// никто не вызывал, а тип File существует только в браузере — в React Native
// файл приходит объектом с uri. Настоящая проверка загружаемых файлов живёт в
// вебе, в src/services/file-validation.ts.
