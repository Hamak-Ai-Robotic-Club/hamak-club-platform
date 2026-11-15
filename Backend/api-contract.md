# API Contract: المصادقة والطلبات

> مسؤول الوثيقة: مالك. تُحدَّث كلما تغيّر العقد.
> الحالة: منفّذ فوق repositories مؤقتة (بيانات بالذاكرة) إلى حين جاهزية قاعدة البيانات.

## قواعد عامة

- **المسار الأساسي:** `/api`
- **الصيغة:** `JSON` للطلب والرد.
- **المصادقة:** جلسة عبر cookie اسمها `sid` (`HttpOnly`، `SameSite=Lax`، و`Secure` في الإنتاج). تُضبط عند `login` وتُمسح عند `logout`. على الواجهة إرسال الطلبات مع الـ cookies (`credentials: "include"`).
- **الجلسات:** حساب الفريق جلسة نشطة واحدة فقط؛ الأدمن جلسات متعددة. مدة الجلسة من `SESSION_TTL_HOURS` (الافتراضي 8 ساعات).
- **شكل الأخطاء الموحّد:** `{ "message": "..." }` مع كود الحالة.

| الكود | المعنى |
|---|---|
| `401` | غير مسجل دخول، أو جلسة منتهية/مبطلة، أو بيانات دخول خاطئة |
| `403` | لا يملك الصلاحية، أو حساب مجمّد، أو طلب يخص فريقاً آخر |
| `404` | غير موجود |
| `409` | تعارض حالة أو مخزون |
| `422` | بيانات غير صالحة |
| `429` | محاولات دخول فاشلة كثيرة |
| `500` | خطأ داخلي (`{ "message": "Server Error" }` بدون تفاصيل) |

## المصادقة

### `POST /api/auth/login`
- **الصلاحية:** عام.
- **Request:** `{ "username": "team1", "password": "..." }`
- **Response `200`:** `{ "user": { "id": 1, "username": "team1", "role": "user" } }` + cookie `sid`.
- **الأخطاء:**
  - `422`: حقل ناقص أو فاضي.
  - `401`: اسم مستخدم أو كلمة مرور خاطئة (نفس الرسالة للحالتين: `Invalid username or password`).
  - `403`: الحساب مجمّد.
  - `409`: حساب فريق لديه جلسة نشطة (`Account already has an active session`).
  - `429`: تجاوز حد المحاولات الفاشلة (10 محاولات لكل 15 دقيقة لكل IP؛ المحاولات الناجحة لا تُحسب).

### `POST /api/auth/logout`
- **الصلاحية:** مسجل دخول.
- **Response `200`:** `{ "message": "Logged out" }` وتُبطل الجلسة الحالية وتُمسح الـ cookie.
- **الأخطاء:** `401`.

### `GET /api/auth/me`
- **الصلاحية:** مسجل دخول.
- **Response `200`:** `{ "user": { "id": 1, "username": "team1", "role": "user" } }`
- **الأخطاء:** `401`، `403` (حساب مجمّد).

## الطلبات (الفريق)

### كائن الطلب (`request`)
```json
{
  "id": 1,
  "teamUserId": 1,
  "projectName": "Smart Greenhouse",
  "projectDescription": "Monitor temperature and humidity",
  "status": "Pending",
  "note": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "createdAt": "2026-11-08T08:00:00.000Z",
  "cancelledAt": null,
  "items": [
    { "componentId": "component-123", "requestedQuantity": 2, "approvedQuantity": 0 }
  ]
}
```
الحالات المنفّذة حالياً: `Pending` و`Approved` و`Rejected` و`Cancelled`. (`Partially Delivered` تأتي مع التسليم.)

### `POST /api/requests`
- **الصلاحية:** `user` فقط.
- **Request:**
```json
{
  "projectName": "Smart Greenhouse",
  "projectDescription": "Monitor temperature and humidity",
  "items": [{ "componentId": "component-123", "quantity": 2 }]
}
```
- **القيود:** `projectName` حتى 100 حرف، `projectDescription` حتى 1000 حرف، `items` بند واحد على الأقل، `quantity` عدد صحيح موجب، بدون تكرار `componentId`، والقطع موجودة وعاملة (غير معطّلة).
- **Response `201`:** `{ "request": { ... } }` بحالة `Pending`. لا يتم حجز مخزون عند الإرسال.
- **الأخطاء:** `422` (بيانات أو قطعة غير متاحة)، `409` (لدى الفريق طلب `Pending`)، `403`، `401`.

### `GET /api/requests`
- **الصلاحية:** `user` (طلباته) أو `admin` (كل الطلبات).
- **Response `200`:** `{ "items": [ request, ... ] }` الأحدث أولاً، بدون الطلبات الملغاة.

### `GET /api/requests/:id`
- **الصلاحية:** صاحب الطلب أو `admin`.
- **Response `200`:** `{ "request": { ... } }`
- **الأخطاء:** `404`، `403` (طلب فريق آخر)، `401`.

### `POST /api/requests/:id/cancel`
- **الصلاحية:** صاحب الطلب فقط (`user`).
- **Response `200`:** `{ "request": { ... "status": "Cancelled" } }`
- **الأخطاء:** `409` (الطلب ليس `Pending`)، `403`، `404`، `401`.

### `PATCH /api/requests/:id`
- لا يوجد تعديل للطلب بعد الإرساله. يرجع دائماً `409` (`Request cannot be edited after submission`) لصاحب الطلب. أخطاء: `403`، `404`، `401`.

## الطلبات (الأدمن)

### `POST /api/admin/requests/:id/approve`
- **الصلاحية:** `admin` فقط.
- **Request:** بدون Body.
- **السلوك:** قبول كامل بالكميات المطلوبة وحجزها في عملية واحدة. المتاح = العامل − المحجوز. إذا نقص أي بند، لا يُحجز شيء.
- **Response `200`:** `{ "request": { ... "status": "Approved" } }` مع `approvedQuantity` لكل بند.
- **الأخطاء:** `409` (ليس `Pending`، أو كمية غير كافية: `Insufficient available quantity: component-123 (requested 5, available 3)`)، `404`، `403`، `401`.

### `POST /api/admin/requests/:id/reject`
- **الصلاحية:** `admin` فقط.
- **Request (اختياري):** `{ "note": "Out of stock" }` (حتى 500 حرف).
- **Response `200`:** `{ "request": { ... "status": "Rejected", "note": "..." } }`
- **الأخطاء:** `409` (ليس `Pending`)، `404`، `403`، `401`.
