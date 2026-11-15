# Hamak Inventory: Backend (مهام مالك) عمل ثراء الحج 
 

الجزء الخاص بـ **Backend** من منصة إدارة مخزون القطع الإلكترونية في نادي الهمك.
يغطي هذا المستند ما تم تنفيذه، وكيفية التشغيل والاختبار، وما هو مؤقت ويجب استبداله عند جاهزية قاعدة البيانات والكتالوج.

> الحالة: جميع مهام P0 المسندة لمالك منفّذة ومختبرة (23 اختباراً ناجحاً). التنفيذ يعمل فوق **repositories مؤقتة** (بيانات بالذاكرة)، انظر قسم "المؤقت وما يجب استبداله".

---

## 1. ما الذي تم تنفيذه

| المهمة (حسب الخطة) | الأولوية | الحالة | أين |
|---|---|---|---|
| إعداد الخادم (Express والإعدادات ومعالجة الأخطاء) | P0 | منفّذ | `app.js`، `middleware/errorHandler.js`، `utils/AppError.js` |
| المصادقة (دخول، خروج، التحقق من كلمات المرور) | P0 | منفّذ | `modules/auth/` |
| الصلاحيات (التحقق من دور الحساب في كل مسار محمي) | P0 | منفّذ | `middleware/authenticate.js`، `middleware/authorize.js` |
| الجلسات (واحدة للفريق، متعددة للأدمن) | P0 | منفّذ | `modules/auth/sessions.repository.js`، `auth.service.js` |
| الطلبات (إنشاء مع اسم المشروع وشرحه والتحقق) | P0 | منفّذ | `modules/requests/` |
| قواعد الطلب (Pending واحد، منع التعديل بعد الإرسال) | P0 | منفّذ | `requests.service.js` |
| القبول والحجز (وتوفر الكميات) | P0 | منفّذ (فوق repository مؤقت) | `requests.repository.js` |
| التكامل (مراجعة PRs) | مستمر | مستمر | |

كذلك نُفّذ من متطلبات Backend بالخطة: التحقق من المدخلات (`zod`)، توحيد رسائل الأخطاء، تحديد معدل محاولات تسجيل الدخول، والاختبارات.

---

## 2. التقنيات

- **Node.js** (ES Modules) و**Express 5** (الأخطاء داخل دوال `async` تصل تلقائياً إلى معالج الأخطاء).
- **zod**: التحقق من المدخلات.
- **bcrypt**: مقارنة كلمات المرور بالـ hash.
- **cookie-parser**: قراءة cookie الجلسة.
- **express-rate-limit**: تحديد محاولات الدخول.
- **dotenv**: متغيرات البيئة.
- الاختبارات: `node:test` المدمج مع **supertest**.

---

## 3. التشغيل

```bash
cd backend
npm install
cp .env.example .env      # ثم عدّل القيم
npm run dev               # تشغيل التطوير (nodemon)
npm test                  # الاختبارات
```

### متغيرات البيئة (`.env.example`)

| المتغير | المعنى | الافتراضي |
|---|---|---|
| `PORT` | منفذ الخادم | `5000` |
| `SESSION_TTL_HOURS` | مدة الجلسة بالساعات | `8` |
| `LOGIN_RATE_LIMIT_MAX` | عدد محاولات الدخول الفاشلة المسموحة لكل 15 دقيقة | `10` |
| `NODE_ENV` | `production` يفعّل `Secure` على الـ cookie | |

> ملف `.env` الحقيقي لا يُرفع إلى GitHub أبداً. يُرفع `.env.example` بأسماء المتغيرات فقط.
> `SESSION_SECRET` و`DATABASE_URL` مذكوران بخطة النشر، وغير مستخدمين حالياً (التوكن عشوائي ويُجزّأ بـ SHA-256، والقاعدة غير مربوطة بعد).

---

## 4. بنية المجلدات

```
backend/
├── src/
│   ├── app.js                        # إنشاء التطبيق، الـ middleware، المسارات، التشغيل
│   ├── config/
│   │   └── session.js                # اسم الـ cookie ومدة الجلسة وخياراتها
│   ├── middleware/
│   │   ├── authenticate.js           # التحقق من الجلسة وإرفاق req.user
│   │   ├── authorize.js              # التحقق من الدور
│   │   ├── validate.js               # التحقق من body بواسطة zod
│   │   ├── loginRateLimiter.js       # تحديد محاولات الدخول
│   │   └── errorHandler.js           # معالج الأخطاء الموحد
│   ├── modules/
│   │   ├── auth/                     # الدخول والخروج والجلسات
│   │   ├── users/                    # (مؤقت) users.repository.js
│   │   ├── components/               # (مؤقت) components.repository.js
│   │   └── requests/                 # الطلبات والقبول والرفض
│   ├── routes/
│   │   ├── route.login.js            # /api/auth
│   │   ├── route.requests.js         # /api/requests
│   │   └── route.admin.js            # /api/admin
│   └── utils/
│       ├── AppError.js
│       └── token.js                  # توليد التوكن وتجزئته
└── tests/                            # اختبارات الدخول والصلاحيات والطلبات والحجز و rate limit
```

### طبقات الكود

```
Route  ->  Middleware (authenticate / authorize / validate)  ->  Controller  ->  Service  ->  Repository
```

- **Route:** يربط المسار بالـ middleware والـ controller.
- **Controller:** يستقبل الطلب ويرد (لا منطق أعمال).
- **Service:** قواعد العمل.
- **Repository:** الوصول إلى البيانات فقط (المكان الذي يستبدله طارق وبتول بـ Prisma).

---

## 5. معالجة الأخطاء

- `AppError(message, statusCode)`: خطأ **متوقع** (مقصود)، يحمل العلامة `isOperational = true`.
- `errorHandler(err, req, res, next)`:
  - إن كان الخطأ `AppError` يرجع رسالته وكوده.
  - غير ذلك (خطأ غير متوقع) يرجع `500` و`{ "message": "Server Error" }` **دون كشف تفاصيل**، ويُطبع الخطأ الحقيقي في الطرفية.
- الشكل الموحد لكل الأخطاء: `{ "message": "..." }`.

| الكود | الاستخدام |
|---|---|
| `401` | غير مسجل، جلسة منتهية، بيانات دخول خاطئة |
| `403` | لا صلاحية، حساب مجمّد، طلب فريق آخر |
| `404` | غير موجود |
| `409` | تعارض حالة أو مخزون |
| `422` | بيانات غير صالحة |
| `429` | محاولات دخول كثيرة |
| `500` | خطأ داخلي |

---

## 6. المصادقة والجلسات

### الدخول `POST /api/auth/login`
بالترتيب:
1. التحقق من المدخلات (`username` و`password` نصوص غير فارغة) وإلا `422`.
2. البحث عن المستخدم بـ `username`. غير موجود: `401`.
3. `bcrypt.compare` مع `password_hash`. خطأ: `401` **بنفس الرسالة** (حتى لا يُكشف أيهما الخطأ).
4. حساب مجمّد: `403`.
5. إن كان الدور `user` ولديه جلسة نشطة: `409` (جلسة واحدة للفريق، ويُرفض الدخول الثاني حتى تنتهي الأولى). الأدمن يسمح له بجلسات متعددة.
6. إنشاء الجلسة وإرسال cookie.

### تفاصيل الجلسة
- التوكن: 32 بايت عشوائية (`crypto.randomBytes`).
- في جدول `sessions` يُخزَّن **SHA-256 للتوكن فقط**، وليس التوكن نفسه.
- الـ cookie: اسمها `sid`، `HttpOnly`، `SameSite=Lax`، و`Secure` في الإنتاج.
- `authenticate` يتحقق عند **كل طلب**: وجود الـ cookie، وجود الجلسة، عدم إبطالها، عدم انتهائها، وجود المستخدم، وأنه غير مجمّد (`403`). لذلك التجميد يمنع الوصول فوراً.
- الخروج `POST /api/auth/logout`: يضع `revoked_at` على الجلسة ويمسح الـ cookie.
- `GET /api/auth/me`: يرجع بيانات المستخدم الحالي.

### تحديد المحاولات
- المحاولات **الفاشلة** فقط تُحسب: 10 كل 15 دقيقة لكل IP، ثم `429`.
- الدخول الناجح لا يُحسب.

---

## 7. الصلاحيات

```javascript
router.get("/", authenticate, authorize("admin"), handler);        // أدمن فقط
router.get("/", authenticate, authorize("user", "admin"), handler); // الاثنان
```

- الدور يُقرأ من الجلسة في الخادم، وليس من الواجهة.
- الترتيب مهم: `authenticate` أولاً ثم `authorize`.
- تحقق **ملكية الطلب**: الفريق لا يقرأ طلب فريق آخر (`403`). الأدمن يقرأ الجميع.

---

## 8. الطلبات

### القواعد
- الفريق فقط ينشئ الطلب (الأدمن `403`).
- الطلب: `projectName` (حتى 100 حرف)، `projectDescription` (حتى 1000)، و`items` (بند واحد على الأقل، `quantity` عدد صحيح موجب، بلا تكرار للقطعة، والقطعة موجودة وعاملة).
- **طلب `Pending` واحد فقط لكل فريق** (`409`). بعد القبول أو الرفض أو الإلغاء يمكن إنشاء طلب جديد.
- **لا تعديل بعد الإرسال**: `PATCH /api/requests/:id` يرجع `409`.
- الإلغاء للمالك فقط، وفقط إذا كان `Pending`. الطلب الملغى يختفي من القائمة ويبقى محفوظاً.
- **الإرسال لا يحجز مخزوناً.**

### الحالات
`Pending` ثم `Approved` أو `Rejected` أو `Cancelled`. (`Partially Delivered` وما بعدها تأتي مع التسليم.)

### القبول والحجز `POST /api/admin/requests/:id/approve`
- المتاح = العامل − المحجوز، والمحجوز = المعتمد − المسلّم − الملغى غير المسلّم (للطلبات `Approved` / `Partially Delivered`).
- القبول **كامل** بالكميات المطلوبة. إن نقصت كمية أي بند: `409` ولا يُحجز **أي** بند (كله أو لا شيء).
- الرفض `POST /api/admin/requests/:id/reject` (ملاحظة اختيارية) لا يغيّر المخزون لأن `Pending` لا يحجز.
- التحقق والحجز في خطوة واحدة (انظر "للقاعدة الحقيقية" في القسم 10).

### أسماء الحقول
- المخزَّن يطابق جدول القاعدة (`snake_case`): `team_user_id`، `project_name`...
- الـ API يستخدم `camelCase` مثل عقد الخطة: `projectName`، `componentId`...

التفاصيل الكاملة للمسارات: `docs/api-contract.md`.

---

## 9. المسارات المنفّذة

| الطريقة | المسار | الصلاحية |
|---|---|---|
| POST | `/api/auth/login` | عام |
| POST | `/api/auth/logout` | مسجل |
| GET | `/api/auth/me` | مسجل |
| GET | `/api/requests` | فريق (طلباته) / أدمن (الكل) |
| POST | `/api/requests` | فريق |
| GET | `/api/requests/:id` | مالك / أدمن |
| POST | `/api/requests/:id/cancel` | مالك |
| PATCH | `/api/requests/:id` | مالك (يرجع دائماً 409) |
| POST | `/api/admin/requests/:id/approve` | أدمن |
| POST | `/api/admin/requests/:id/reject` | أدمن |

---

## 10. المؤقت وما يجب استبداله

القاعدة (طارق) والكتالوج (بتول) لم يجهزا، لذلك كُتبت **repositories مؤقتة** بمصفوفات في الذاكرة، بنفس أسماء حقول الجداول في الخطة. **البيانات تضيع عند كل إعادة تشغيل.**
الـ services والـ controllers لا تتغير عند الاستبدال، فقط ملفات `*.repository.js`.

### ما يجب على طارق (Prisma) أن يوفره

| الملف المؤقت | الدوال المطلوبة | تعيد |
|---|---|---|
| `modules/users/users.repository.js` | `findByUsername(username)`، `findById(id)` | `{ id, username, password_hash, role, is_frozen }` أو `null` |
| `modules/auth/sessions.repository.js` | `createSession({ user_id, token_hash, expires_at })`، `findByTokenHash(hash)`، `findActiveByUserId(user_id)`، `revokeById(id)`، `revokeAllByUserId(user_id)` | سجلات `sessions` |
| `modules/requests/requests.repository.js` | `createRequest`، `findById`، `findByTeam`، `findAll`، `findPendingByTeam`، `markCancelled`، `markRejected`، `approveWithReservation` | سجل الطلب مع `items` (`request_items`) |

### ما يجب على بتول أن يوفره
`modules/components/components.repository.js`:
- `findByIds(ids)` تعيد `{ id, name, is_active, ... }`.
- `getWorkingQuantity(id)` (متزامنة حالياً للمحاكاة؛ في النسخة الحقيقية تُقرأ داخل نفس الـ transaction).

### بيانات تجريبية مؤقتة (تُحذف مع الـ repositories)

| المستخدم | الدور | ملاحظة |
|---|---|---|
| `team1`، `team2` | `user` | |
| `admin1` | `admin` | |
| `frozen1` | `user` | مجمّد |

كلمة المرور لكلها: `Team@12345`. القطع: `component-123` (عامل 8)، `component-124` (عامل 3)، `component-125` (معطّلة).

### للقاعدة الحقيقية (مهم)
1. **القبول والحجز:** `approveWithReservation` يجب أن يصبح `Prisma $transaction` مع قفل صفوف القطع (`SELECT ... FOR UPDATE`) أو عزل `Serializable`. في الذاكرة Node ينفّذه بخطوة واحدة، أما في القاعدة فطلبان متزامنان قد يريان نفس المتاح (اختبار الخطة: حجز متزامن لآخر كمية).
2. **طلب Pending واحد:** يجب فرضه أيضاً بـ **Partial Unique Index** (مذكور بمخطط الخطة)، لأن الفحص في الكود وحده لا يمنع طلبين متزامنين.
3. **جلسة واحدة للفريق:** نفس الملاحظة (قيد أو transaction)، حتى لا ينجح دخولان متزامنان.
4. **التجميد:** عند تنفيذ `PATCH /api/admin/users/:id/status` يجب استدعاء `revokeAllByUserId(userId)`.
5. **النشر:** تفعيل HTTPS (الـ cookie `Secure` بالإنتاج) وضبط `trust proxy` إن كان خلف proxy حتى يعمل rate limit بشكل صحيح.

---

## 11. ما أُضيف خارج نص الخطة (للتوضيح)

الخطة حددت المجلدات والمهام، ولم تحدد أسماء بعض الملفات. هذه قرارات تنفيذ يمكن تعديلها:

- أسماء الملفات: `config/session.js`، `utils/token.js`، `middleware/authenticate.js` و`authorize.js` و`validate.js` و`loginRateLimiter.js`، و`routes/route.*.js`.
- مدة الجلسة 8 ساعات، واسم الـ cookie `sid`، وتجزئة التوكن بـ SHA-256.
- `409` عند الدخول الثاني حتى من نفس الجهاز إن كانت الجلسة فعّالة.
- ملكية طلب فريق آخر ترجع `403` (يمكن جعلها `404`).
- `PATCH` على الطلب يرجع `409` لتحقيق اختبار "رفض التعديل بعد الإرسال".
- القبول دائماً بالكمية المطلوبة كاملة (الجدول فيه `approved_quantity` منفصلة إن أُريد قبول جزئي لاحقاً).
- حدود الأحرف (100 و1000 و500) وحد المحاولات (10 كل 15 دقيقة) و`429`.
- رفض تكرار نفس القطعة في الطلب (`422`).

---

## 12. الاختبارات

```bash
npm test
```

23 اختباراً في 5 ملفات (`tests/`)، تغطي اختبارات القبول الإلزامية في الخطة:

| الملف | يغطي |
|---|---|
| `auth.test.js` | الدخول، رسالة موحدة للخطأ، المجمّد، التحقق، جلسة واحدة للفريق، جلسات الأدمن، الخروج |
| `authorization.test.js` | `401` بدون جلسة، `403` لمستخدم عادي على API أدمن، الأدمن لا ينشئ طلباً |
| `requests.test.js` | الإنشاء، طلب ثانٍ أثناء Pending، رفض التعديل، الملكية، الإلغاء، القبول/الرفض، `422` |
| `reservation.test.js` | كله أو لا شيء، حجز متزامن لآخر كمية، الرفض لا يحجز |
| `rateLimit.test.js` | الدخول الناجح لا يُحسب، `429` بعد المحاولات الفاشلة |

كل ملف يعمل في عملية منفصلة بذاكرة نظيفة.

---

## 13. المتبقي

- استبدال الـ repositories المؤقتة بـ Prisma عند جاهزية قاعدة البيانات والكتالوج.
- تسجيل القبول والرفض في `audit_logs`.
- مسار تجميد الحساب (`PATCH /api/admin/users/:id/status`) مع إبطال الجلسات.
- التسليم والإرجاع (مسؤولية بتول)، واستكمال العقد بعد دمجهما.
- مراجعة PRs وتوافق الوحدات (مهمة التكامل المستمرة).

---

## 14. دورة العمل مع Git

- `main`: مستقر، بدون تعديل مباشر.
- `develop`: تجميع الميزات.
- فرع لكل ميزة: `feature/...`، ثم Pull Request إلى `develop`.
- الرسائل: `feat(backend): ...` و`fix(backend): ...`.
- لا ترفعوا `.env` أو كلمات مرور أو مفاتيح.
