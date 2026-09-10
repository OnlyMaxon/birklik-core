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
  title: string
  message: string
  read: boolean
  createdAt: string
  relatedId?: string // propertyId, commentId, etc.
  relatedUserId?: string
  relatedUserName?: string
  actionUrl?: string
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
