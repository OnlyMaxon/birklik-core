/**
 * Платный тариф и срок.
 *
 * Объявлены здесь, а не взяты из `types`: там живёт `ListingTier`, куда входят
 * ещё `free` и `standard` — бесплатные, у них цены нет по определению. Одинаковые
 * имена есть и в `firebase-functions/src/payment/apply-tier.ts`; тянуть их
 * оттуда нельзя, функции собираются отдельным пакетом.
 */
export type PaidTier = 'vip' | 'premium'
export type TierDuration = '14days' | '30days'

/**
 * Цены платных тарифов в манатах — **единственный источник для сайта и
 * приложения**.
 *
 * До этого числа 20/30/55 лежали двумя отдельными копиями: в
 * `firebase-functions/src/payment/azericard.ts` (по ней банк берёт деньги) и в
 * `src/app/property/[id]/components/owner-actions.tsx` (её показывает сайт).
 * Приложение цену не знало вовсе и брало у магазина.
 *
 * ⚠️ **Копий всё ещё две, и вторую убрать нельзя.** Функции собираются
 * отдельным пакетом и подмодуль `core` в сборку не тянут — импорт отсюда не
 * соберётся. Поэтому `azericard.ts` держит свою копию, и там стоит отсылка
 * сюда. **Меняя цену, править оба места.** Расхождение выглядит как «на экране
 * одна сумма, списали другую».
 */
export const TIER_PRICES: Record<PaidTier, Record<TierDuration, number>> = {
  vip: {'14days': 20, '30days': 30},
  premium: {'14days': 30, '30days': 55}
}

/** Валюта площадки. Ею же считает Azericard — см. `CURRENCY` в `azericard.ts`. */
export const TIER_CURRENCY = 'AZN'

/** Цена тарифа по сроку в днях — так его задаёт приложение. */
export function tierPriceByDays(tier: PaidTier, days: number): number | undefined {
  return TIER_PRICES[tier]?.[days === 14 ? '14days' : '30days']
}

/**
 * Сумма манатами для показа человеку: `55 ₼`.
 *
 * Знак после числа и через неразрывный пробел — так пишут в Азербайджане, и так
 * число с валютой не разорвётся переносом строки.
 */
export function formatAzn(amount: number): string {
  return `${amount} ₼`
}

/**
 * Сколько снимков разрешено тарифу.
 *
 * ⚠️ До 2026-10-10 эти числа жили только на сайте — литералами `20` и `30` в
 * `use-listing-editor.ts`. Приложение о них не знало и держало свои 15 на все
 * тарифы, да ещё и **молча отрезало** лишние: человек платил за Premium,
 * прикладывал тридцать снимков и получал пятнадцать без единого слова. Отсюда
 * правило: число живёт здесь, оба приложения спрашивают.
 *
 * Бесплатным тарифам (`free`, `standard`) положено столько же, сколько VIP, —
 * платное отличается не количеством снимков, а местом в выдаче и значком.
 * Лишнее место у Premium — единственное исключение.
 */
export const TIER_PHOTO_LIMITS = {standard: 20, vip: 20, premium: 30} as const

/**
 * Предел снимков для тарифа. Неизвестный тариф получает обычный предел:
 * ошибаться надо в сторону меньшего, иначе человек приложит тридцать снимков и
 * упрётся в отказ уже при сохранении.
 */
export function photoLimitForTier(tier: string | undefined): number {
  if (tier === 'premium') return TIER_PHOTO_LIMITS.premium
  if (tier === 'vip') return TIER_PHOTO_LIMITS.vip
  return TIER_PHOTO_LIMITS.standard
}
