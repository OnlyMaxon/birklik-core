import type {ListingTier} from '../types'
import {tierRank} from './premium-helper'

/**
 * Подъём объявления в выдаче: единственное место, где решается «поднято ли оно
 * прямо сейчас» и каким временем его сравнивать с соседями.
 *
 * Рядом с `premium-helper.ts` и по той же причине: правило обязано быть одно на
 * сайт и приложение. Firestore умеет отобрать поднятые запросом, но порядок
 * внутри полосы считает КАЖДЫЙ клиент сам — разъедься эта функция между двумя
 * реализациями, и на телефоне наверху стояло бы не то, что на сайте.
 */

/**
 * Сколько держится один подъём.
 *
 * Сутки с запасом в час, и запас тут не произвол. Пакет на несколько подъёмов
 * расходуется ночной задачей — по одному в сутки, — и окно обязано переживать
 * промежуток между её прогонами. Будь оно ровно 24 часа, задержка планировщика
 * на пять минут роняла бы объявление из полосы до следующего прогона: человек
 * заплатил за десять дней наверху и видел бы провалы.
 *
 * Для одиночного подъёма это значит «сутки и ещё немного» — ошибка в пользу
 * заплатившего, и такой она быть и должна.
 */
export const BOOST_WINDOW_MS = 25 * 60 * 60 * 1000

interface BoostedListing {
  /** Момент последнего подъёма, ISO. Ставит только сервер. */
  boostedAt?: string
  createdAt?: string
}

/** Всё, что нужно знать об объявлении, чтобы поставить его в выдаче. */
export interface ComparableListing extends BoostedListing {
  listingTier?: ListingTier
  premiumExpiresAt?: string
  vipExpiresAt?: string
}

/** Момент в миллисекундах или `null`, если даты нет или она не разбирается. */
function timestamp(value: string | undefined): number | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

/**
 * Действует ли подъём прямо сейчас.
 *
 * `now` передаётся снаружи ради тестов; в бою его не передаёт никто.
 */
export function isBoostActive(listing: BoostedListing, now: number = Date.now()): boolean {
  const boosted = timestamp(listing.boostedAt)
  if (boosted === null) return false
  // Подъём из будущего не признаём: такую дату может дать только сбой часов или
  // правка руками, а признав её, мы отдали бы верх полосы навсегда.
  if (boosted > now) return false
  return now - boosted < BOOST_WINDOW_MS
}

/**
 * Вес подъёма внутри своей полосы: поднятое выше непонятого, и только.
 *
 * Полосу подъём НЕ меняет — тариф сильнее. Стандартное объявление поднимается
 * наверх стандартных и не обгоняет ни VIP, ни Premium.
 */
export function boostRank(listing: BoostedListing, now: number = Date.now()): number {
  return isBoostActive(listing, now) ? 1 : 0
}

/**
 * Время, которым объявление сравнивается с соседями по полосе.
 *
 * У поднятого это момент подъёма, у остальных — дата создания. Сравнивать
 * поднятые между собой надо именно по подъёму: кто поднялся позже, стоит выше.
 * Иначе пакет на десять дней не отличался бы от одиночного — оба стояли бы по
 * своей исходной дате, и ежедневный подъём не значил бы ничего.
 */
export function listingSortTime(listing: BoostedListing, now: number = Date.now()): number {
  if (isBoostActive(listing, now)) return timestamp(listing.boostedAt) ?? 0
  return timestamp(listing.createdAt) ?? 0
}

/**
 * Порядок двух объявлений в выдаче — **единственное место, где он решается**.
 *
 * ```
 * 1. вес тарифа      Premium выше VIP, VIP выше обычного, истёкший как обычный
 * 2. подъём          поднятое выше неподнятого ВНУТРИ своей полосы
 * 3. время           у поднятого момент подъёма, у остальных дата создания
 * ```
 *
 * Вынесено отдельной функцией не ради красоты. Копий этого сравнения было две:
 * в `filterProperties` и в `getCityProperties` на страницах регионов, — и
 * вторая отставала от первой. Разойдясь ещё раз, они дадут то, что уже было:
 * на главной оплаченное место работает, а на странице региона, куда ведёт
 * длинный хвост поисковых запросов, — нет.
 *
 * ⚠️ Порядок шагов — это цена. Переставь подъём выше тарифа, и поднятое за два
 * маната обычное объявление встанет выше оплаченного за пятьдесят пять
 * Premium. Проверка типов такого не поймает: оба шага возвращают число.
 */
export function compareListings(a: ComparableListing, b: ComparableListing): number {
  const rankDiff = tierRank(b) - tierRank(a)
  if (rankDiff !== 0) return rankDiff
  const boostDiff = boostRank(b) - boostRank(a)
  if (boostDiff !== 0) return boostDiff
  return listingSortTime(b) - listingSortTime(a)
}
