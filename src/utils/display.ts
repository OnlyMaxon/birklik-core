import type {Property} from '../types'
import {isTierExpired} from './premium-helper'

/**
 * Показывать ли объявление в списках прямо сейчас.
 *
 * Статус `inactive` объявлению проставляет ночная функция `expirePaidTiers`, и
 * между окончанием тарифа и её прогоном проходит до суток. Всё это время
 * объявление формально `active` — то есть выборки его брали, и оно висело на
 * витрине уже после того, как оплаченный срок кончился.
 *
 * Здесь та же проверка делается по дате, в момент показа: истёкшее уходит с
 * витрины сразу. Ночная функция после этого лишь закрепляет положение в базе,
 * проставляя `status` и `expiredAt`.
 *
 * Обычный тариф не истекает — `isTierExpired` для него всегда ложь.
 *
 * ⚠️ Правило общее для сайта и приложения намеренно. Firestore умеет отобрать
 * только по `status`, поэтому досеивать по дате обязан КАЖДЫЙ клиент. Разъедься
 * эта функция между двумя реализациями — и на телефоне неделю висели бы
 * объявления, которых на сайте уже нет.
 */
export function isOnDisplay(
  property: Pick<Property, 'status' | 'listingTier' | 'premiumExpiresAt' | 'vipExpiresAt'>
): boolean {
  if (property.status && property.status !== 'active') return false
  return !isTierExpired(property)
}
