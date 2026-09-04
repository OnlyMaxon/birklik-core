import type {Language} from '../types'

/**
 * Тексты ошибок входа и регистрации на трёх языках.
 *
 * Собраны сюда из двух компонентов сайта, где лежали двумя почти одинаковыми
 * копиями, вшитыми прямо в разметку. Приложению нужны те же самые — третьей
 * копии быть не должно.
 *
 * В словари переводов это не переехало намеренно: ключи там называются по
 * смыслу интерфейса, а здесь ключ — код ошибки Firebase, и связь должна быть
 * видна с одного взгляда.
 */

type Trilingual = Record<Language, string>

const MESSAGES: Record<string, Trilingual> = {
  'auth/invalid-credential': {
    az: 'Email və ya şifrə yanlışdır',
    en: 'Incorrect email or password',
    ru: 'Неверный email или пароль'
  },
  'auth/too-many-requests': {
    az: 'Həddindən artıq cəhd edildi. Zəhmət olmasa bir az sonra yenidən yoxlayın',
    en: 'Too many attempts. Please try again later',
    ru: 'Слишком много попыток. Попробуйте позже'
  },
  'auth/network-request-failed': {
    az: 'Şəbəkə xətası. İnternet bağlantınızı yoxlayın',
    en: 'Network error. Check your connection',
    ru: 'Ошибка сети. Проверьте подключение'
  },
  'auth/email-already-in-use': {
    az: 'Bu email artıq qeydiyyatdan keçib',
    en: 'This email is already registered',
    ru: 'Этот email уже зарегистрирован'
  },
  'auth/invalid-email': {
    az: 'Email düzgün deyil',
    en: 'Invalid email',
    ru: 'Некорректный email'
  },
  'auth/weak-password': {
    az: 'Şifrə ən azı 6 simvoldan ibarət olmalıdır',
    en: 'Password must be at least 6 characters',
    ru: 'Пароль должен содержать минимум 6 символов'
  },
  'auth/invalid-name': {
    az: 'Düzgün ad daxil edin',
    en: 'Please enter a valid name',
    ru: 'Укажите корректное имя'
  },
  'auth/invalid-phone-number': {
    az: 'Düzgün telefon nömrəsi daxil edin',
    en: 'Please enter a valid phone number',
    ru: 'Укажите корректный номер телефона'
  },
  // Не код Firebase, а собственные проверки формы — держим рядом, чтобы формы
  // не хранили свои строки в разметке, как было на сайте.
  'form/passwords-do-not-match': {
    az: 'Şifrələr uyğun gəlmir',
    en: 'Passwords do not match',
    ru: 'Пароли не совпадают'
  }
}

/**
 * Сообщение по коду ошибки. Возвращает `null` для незнакомого кода —
 * подставить свой общий текст решает вызывающая сторона: на сайте это
 * `t.messages.error`, и придумывать здесь замену ему незачем.
 *
 * Устаревшие коды `auth/wrong-password` и `auth/user-not-found` сведены к
 * `auth/invalid-credential`: Firebase давно отдаёт только его, но старые
 * сборки и кеши могут вернуть прежние.
 */
export function authErrorMessage(code: string, language: Language): string | null {
  const key =
    code === 'auth/wrong-password' || code === 'auth/user-not-found'
      ? 'auth/invalid-credential'
      : code
  return MESSAGES[key]?.[language] ?? null
}

/** Коды, для которых текст есть. Нужен тестам и проверке полноты. */
export const KNOWN_AUTH_ERROR_CODES = Object.keys(MESSAGES)
