/**
 * Notification Type - User notifications for bookings, comments, favorites, replies, premium
 *
 * Здесь лежали ещё семь уточняющих интерфейсов: BookingNotification,
 * CommentNotification, FavoriteNotification, ReplyNotification,
 * PremiumNotification, ReportNotification, InvoiceSentNotification. Убраны
 * 2026-09-10: их не импортировал ни веб, ни функции, ни приложение — документ
 * уведомления всюду читается как плоский `Notification`, а текст пишется при
 * его создании. Оставшиеся уточнения (Rating, ListingRejected, Booking*,
 * Cancellation*) используются, их не трогать.
 */

export type NotificationType = 'booking' | 'bookingApproved' | 'bookingRejected' | 'comment' | 'favorite' | 'reply' | 'premium' | 'commentReport' | 'rating' | 'cancellationRequest' | 'cancellationApproved' | 'cancellationRejected' | 'listingRejected' | 'invoiceSent'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  /**
   * ⚠️ Заголовок и текст пишутся на АНГЛИЙСКОМ и не переводятся: сервер
   * складывает их строкой при создании («New booking request», «${имя} booked
   * your property»), а язык читателя в этот момент неизвестен.
   *
   * Поэтому единственным содержимым карточки их держать не стоит — подпись
   * собирается из полей ниже и своих переводов, а `message` остаётся запасным
   * вариантом для видов, у которых подробностей нет.
   */
  title: string
  message: string
  read: boolean
  createdAt: string
  relatedId?: string // propertyId, commentId, etc.
  relatedUserId?: string
  relatedUserName?: string
  actionUrl?: string

  /**
   * Подробности уведомления.
   *
   * ⚠️ Эти поля сервер писал в документ С САМОГО НАЧАЛА — их не было только в
   * ТИПЕ. Из-за этого приложение рисовало пустые карточки: читать было нечего,
   * хотя в базе лежало всё. Добавлены 2026-10-06 по разбору кода, который
   * уведомления создаёт, — `property/[id]/actions.ts` и
   * `property/[id]/lib/interactions.ts` на сайте.
   *
   * Необязательные намеренно: документы разных видов несут разный набор, и
   * требовать их на плоском `Notification` значило бы соврать про половину.
   * Кто что несёт:
   *
   * - `booking` — propertyId, bookingId, bookerName/Email/Phone, даты
   * - `bookingApproved`, `bookingRejected` — ещё propertyTitle и ownerName
   * - `comment` — propertyId, commentId, commenterName, commentText
   * - `rating` — propertyId, raterName, ratingValue
   * - `commentReport` — propertyId, commentId; ⚠️ `relatedId` здесь НЕ
   *   объявление, а комментарий, и вести по нему на объявление нельзя
   *
   * ⚠️ Названия объявления у `booking` НЕТ — только `propertyId`. Чтобы
   * показать название, его берут из своих объявлений по этому идентификатору.
   */
  propertyId?: string
  propertyTitle?: string
  bookingId?: string
  bookerName?: string
  bookerEmail?: string
  bookerPhone?: string
  checkInDate?: string
  checkOutDate?: string
  commentId?: string
  commenterName?: string
  commentText?: string
  raterName?: string
  ratingValue?: number
  ownerName?: string
  rejectionReason?: string
}

export interface RatingNotification extends Notification {
  type: 'rating'
  propertyId: string
  raterName: string
  ratingValue: number
}

export interface CancellationRequestNotification extends Notification {
  type: 'cancellationRequest'
  bookingId: string
  propertyId: string
  requesterName: string
  requesterEmail: string
  checkInDate: string
  checkOutDate: string
}

export interface CancellationApprovedNotification extends Notification {
  type: 'cancellationApproved'
  bookingId: string
  propertyId: string
  propertyTitle: string
  checkInDate: string
  checkOutDate: string
}

export interface CancellationRejectedNotification extends Notification {
  type: 'cancellationRejected'
  bookingId: string
  propertyId: string
  propertyTitle: string
  checkInDate: string
  checkOutDate: string
}

export interface BookingApprovedNotification extends Notification {
  type: 'bookingApproved'
  bookingId: string
  propertyId: string
  propertyTitle: string
  checkInDate: string
  checkOutDate: string
  ownerName: string
}

export interface BookingRejectedNotification extends Notification {
  type: 'bookingRejected'
  bookingId: string
  propertyId: string
  propertyTitle: string
  checkInDate: string
  checkOutDate: string
  ownerName: string
  rejectionReason?: string
}

export interface ListingRejectedNotification extends Notification {
  type: 'listingRejected'
  propertyId: string
  propertyTitle: string
  rejectionReason: string
}
