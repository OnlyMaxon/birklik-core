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
