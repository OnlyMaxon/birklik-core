export type PropertyType = 'villa' | 'apartment' | 'house' | 'cottage' | 'penthouse' | 'aframe' | 'sanatorium' | 'recreation'

/**
 * Список районов Абшерона. Оставлен ради подписей в переводах (`t.districts`) —
 * им подписываются старые записи, у которых не заполнен `city`.
 *
 * ⚠️ Типом поля `district` он больше не служит и служить не может. Значение туда
 * попадает не выбором из списка, а копией первого элемента `locationTags`:
 * в боевой базе там двадцать разных значений — названия сёл как есть (`Vəndam`,
 * `Talıstan`, `Qəçreş`) и опечатанные варианты самого списка (`merdekan` вместо
 * `mardakan`, `suvelan` вместо `shuvalan`). Union это никогда не описывал.
 */
export type District = 'mardakan' | 'novkhani' | 'buzovna' | 'bilgah' | 'zagulba' | 'pirshagi' | 'shuvalan' | 'baku' | 'nabran' | 'gabala'

export type LocationCategory = 'rayon' | 'metro'

export type Amenity = 'pool' | 'parking' | 'wifi' | 'ac' | 'kitchen' | 'tv' | 'washer' | 'garden' | 'bbq' | 'security' | 'beach' | 'gym'

export interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  text: string
  createdAt: string
  updatedAt?: string
  parentCommentId?: string // Optional: for nested replies
  replies?: Comment[] // Optional: nested reply comments
}

export type ReportReason = 'spam' | 'inappropriate' | 'offensive' | 'misleading' | 'other'

export interface CommentReport {
  id: string
  propertyId: string
  commentId: string
  commentText: string
  reportedBy: string
  reportedByName: string
  reason: ReportReason
  details?: string
  createdAt: string
  status: 'open' | 'closed'
  commentDeleted: boolean
}

export interface LocalizedText {
  az: string
  en: string
  ru?: string
}

export interface PropertyPrice {
  daily: number
  weekly: number
  monthly: number
  currency: string
}

export interface PropertyOwner {
  name: string
  phone: string
  email: string
}

export type ListingTier = 'free' | 'standard' | 'premium' | 'vip'

export type ListingStatus = 'active' | 'pending' | 'inactive' | 'draft'

export interface Property {
  id: string
  type: PropertyType
  /**
   * Подпись места внутри региона. Свободная строка, а не значение из списка:
   * пишется как копия `locationTags[0]`. Управляемая ось географии — `city`,
   * тонкая — `locationTags`; это поле лишь дублирует второе и живёт ради
   * старых записей.
   */
  district: string
  price: PropertyPrice
  rooms: number
  minGuests: number
  maxGuests: number
  area: number
  amenities: Amenity[]
  images: string[]
  coordinates: { lat: number; lng: number }
  title: LocalizedText
  description: LocalizedText
  address: LocalizedText
  owner: PropertyOwner
  /** Средняя оценка, округлённая до десятых. Считает сервер по `ratings`. */
  rating?: number
  /** Сколько человек оценило — длина `ratings`, не число комментариев. */
  reviews?: number
  /**
   * Оценки по одной на человека: ключ — его идентификатор.
   *
   * Картой, а не списком, намеренно: повторная оценка заменяет прежнюю, а не
   * добавляет вторую от того же. Отсюда же берётся `reviews`.
   *
   * Поле существовало в базе и раньше — сервер писал его при оценке, — но в
   * типе объявлено не было. Приложению оно понадобилось, чтобы показать
   * человеку его собственную оценку закрашенными звёздами.
   */
  ratings?: Record<string, number>
  // Likes and comments
  likes?: string[] // Array of user IDs who liked this property
  favorites?: string[] // Array of user IDs who favorited this property
  views?: number // Total number of views
  comments?: Comment[]
  // Firebase specific fields
  ownerId?: string
  listingTier?: ListingTier
  status?: ListingStatus
  isFeatured?: boolean
  isActive?: boolean
  unavailableFrom?: string
  unavailableTo?: string
  extraFeatures?: string[]
  nearbyPlaces?: string[]
  locationCategory?: LocationCategory
  locationTags?: string[]
  createdAt?: string
  updatedAt?: string
  city?: string
  premiumExpiresAt?: string // ISO date when premium status expires
  vipExpiresAt?: string // ISO date when VIP status expires
  tierPlanDuration?: '14days' | '30days' // Selected plan duration for current tier
  /**
   * Момент последнего подъёма объявления, ISO.
   *
   * Пишет ТОЛЬКО сервер — правила Firestore держат это поле в списке
   * запрещённых владельцу наравне с `listingTier` и датами тарифов. Иначе
   * подъём делался бы из браузера бесплатно.
   *
   * Поля нет у объявления, которое не поднимали ни разу, и переносить сюда
   * `createdAt` для «ровности» НЕЛЬЗЯ: выборка поднятых отбирает их по наличию
   * этой даты, а `isBoostActive` считает по ней срок. Что значит отсутствие и
   * как сравнивается порядок — в `utils/boost-helper.ts`.
   */
  boostedAt?: string
  expiredAt?: string // ISO date when listing was deactivated due to expired premium/VIP
  /**
   * Кто правил объявление в последний раз. Пишется только там, где правит
   * МОДЕРАТОР, — собственная правка владельца автора не требует, он и так один.
   *
   * Нужно журналу правок тарифа: `auditTierChanges` на сервере видит, что
   * ступень или дата поменялись, но кто это сделал, из триггера не узнать —
   * у него нет вошедшего. Поле и есть ответ.
   *
   * ⚠️ Верить ему можно ТОЛЬКО когда в этой же записи поменялся `updatedAt`.
   * Иначе это автор прошлой правки, и правка через консоль Firebase
   * приписалась бы ему — хуже, чем «автор неизвестен».
   */
  updatedBy?: string
  /**
   * Объявление снято с витрины БЛОКИРОВКОЙ владельца, а не им самим.
   *
   * ⚠️ Отдельное поле, а не вывод из `status`, и это единственное, что делает
   * разблокировку безопасной. Блокировка переводит объявления в `inactive` —
   * но часть их владелец скрыл сам и раньше. Без пометки разблокировка вернула
   * бы на витрину и те, то есть показала бы людям объявления, которые человек
   * намеренно прятал.
   *
   * Поля НЕТ у объявления, которое блокировка не трогала. При разблокировке
   * оно удаляется, а не ставится в `false`: выборка отбирает по НАЛИЧИЮ поля,
   * как `boostedAt`.
   */
  hiddenByBlock?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  /**
   * Блокировка модератором: человек входит и смотрит, но не публикует
   * объявления, не комментирует, не оценивает и не бронирует.
   *
   * ⚠️ Это поля документа `users/{id}`, а НЕ снимка `owner` внутри объявления.
   * В снимок они не копируются намеренно: он делается при создании объявления
   * и о позднейшей блокировке знать не может. Решение о запрете принимается по
   * документу человека (на сервере) или по заявке в токене (в правилах), и
   * никогда по снимку.
   *
   * ⚠️ Настоящий запрет живёт в ДВУХ местах, и поле здесь — ни одно из них:
   * заявка `blocked` в токене (правила Firestore) и проверка в
   * `interactions.ts` на сервере. Это поле — то, что видит модератор в списке
   * и что человек читает как причину. Снять блокировку правкой профиля из
   * браузера нельзя: правила держат ключи `blocked`, `blockedReason`,
   * `blockedAt` и `blockedBy` в запрещённых владельцу наравне с `isModerator`.
   */
  blocked?: boolean
  /** Причина словами модератора. Человек видит её у себя в кабинете. */
  blockedReason?: string
  blockedAt?: string
  /** uid модератора, поставившего блокировку. */
  blockedBy?: string
}

export interface FilterState {
  search: string
  minPrice: number | null
  maxPrice: number | null
  rooms: number | null
  type: PropertyType | ''
  // Фильтра по району здесь больше нет: интерфейс поиска его никогда не
  // заполнял — место выбирается через город и `locationTags`, — а сравнение
  // всё равно не сходилось из-за свободных значений в данных.
  hasPool: boolean | null
  extraFilters: string[]
  nearbyPlaces: string[]
  city: string
  locationCategory: LocationCategory
  locationTags: string[]
  checkIn: string
  checkOut: string
  minGuests: number | null
  maxGuests: number | string | null
}

export interface Booking {
  id: string
  propertyId: string
  userId: string
  ownerId: string
  userName: string
  userEmail: string
  userPhone: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalPrice: number
  createdAt: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'cancellation_requested'
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
}
