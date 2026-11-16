# منصة لوجستيات هاكاثون الهمك — HMK Hackathon Logistics

منصة نادي الهمك للذكاء الصنعي والروبوتيك لإدارة مخزون القطع الإلكترونية وطلبات الفرق والعهد (التسليم والإرجاع) مع مساعد تقني للهاكاثون.
النسخة الحالية هي **الدمج الكامل** لعمل الفريق: قاعدة بيانات طارق، وخادم بتول/طارق/مالك (مهام مالك نفّذتها ثراء)، وواجهة لجين (التي تجمع مهام لجين ومحمد)، مع ربطها ببعض وتجهيزها للنشر على **Vercel + Supabase**.

| الجزء | التقنية | المسار |
|---|---|---|
| الواجهة (بوابة الفرق `/` + لوحة الإدارة `/admin`) | React 18 + Vite + CSS (تصميم لجين) | `frontend/` |
| الخادم (REST API) | Node.js + Express 5 | `backend/src/` |
| قاعدة البيانات | PostgreSQL (Supabase) + Prisma 7 + Triggers | `backend/prisma/` و `supabase/schema.sql` |
| دالة Vercel | Express داخل Serverless Function | `api/index.js` |
| صور القطع | ملفات ثابتة في الواجهة + Supabase Storage للصور المرفوعة | `frontend/public/components/` |

```
hamak-logistics/
├── api/index.js              ← نقطة دخول Vercel (كل /api/*)
├── backend/                  ← Express API + Prisma schema + migrations + tests
├── frontend/                 ← React (بوابة الفرق + لوحة الإدارة)
├── supabase/schema.sql       ← قاعدة البيانات كاملة (تُشغَّل مرة واحدة)
├── supabase/storage.sql      ← Bucket صور القطع
├── docs/                     ← الخطة الأصلية + ملاحظات الدمج + عقد الـ API
├── vercel.json  package.json  prisma.config.ts  .env.example
```

---

## 1) الواجهتان

**بوابة الفرق (الطلاب) — `https://<domain>/`**
دخول بحساب الفريق (جلسة واحدة لكل فريق) ← الرئيسية ← كتالوج القطع بالصور والكمية المتاحة فعلياً ← سلة ← طلب جديد (اسم المشروع + فكرته + أسماء الأعضاء + القطع) مع تأكيد بعدم التعديل بعد الإرسال ← طلباتي (الحالة + حالة الإرجاع + الإلغاء قبل المراجعة) ← العهدة المجمّعة ← المساعد التقني (أفكار مشاريع + توصيات قطع من المخزون الحقيقي ونقلها لنموذج الطلب دون إرسال).

**لوحة الإدارة — `https://<domain>/admin`** (اسم مستخدم + كلمة مرور الأدمن)
لوحة التحكم (حالة النظام لحظياً) · طلبات الفرق (قبول كامل/رفض كامل مع سبب، تسليم جزئي على دفعات، إرجاع سليم/عاطل) · إدارة المخزون (بطاقات أو جدول، إضافة قطعة بصورة، تعديل الكميات والحالة والصورة، تعطيل/حذف مشروط) · العهد المفتوحة · الحسابات (إنشاء فرق/أدمن، تجميد، إعادة كلمة المرور، إنهاء الجلسات) · التقارير وسجل التدقيق (CSV/طباعة) · تصفير الهاكاثون.

الصلاحيات كلها مفروضة في الخادم؛ الفصل بين الواجهتين للتجربة فقط.

---

## 2) النشر على Supabase + Vercel (خطوة بخطوة)

### أ. Supabase
1. أنشئ مشروعاً جديداً في [supabase.com](https://supabase.com) واحفظ كلمة مرور قاعدة البيانات.
2. **SQL Editor → New query** ← الصق محتوى `supabase/schema.sql` كاملاً ← **Run**.
   ينشئ الجداول والقيود والـ Triggers، ويستورد جرد الكيتات (52 صنفاً من ملفي الإكسل بأعدادهما)، ويربط كل قطعة بصورتها، ويفعّل RLS.
3. **SQL Editor** مرة أخرى ← الصق `supabase/storage.sql` ← **Run** (ينشئ bucket عام `component-images` للصور التي يرفعها الأدمن).
4. من **Connect** (أعلى لوحة المشروع) انسخ:
   - *Transaction pooler* (المنفذ 6543) ← سيكون `DATABASE_URL`
   - *Session pooler* (المنفذ 5432) ← `DIRECT_URL` (اختياري، للترحيلات عبر Prisma فقط)
5. من **Project Settings → API** انسخ `Project URL` ← `SUPABASE_URL` و `service_role` key ← `SUPABASE_SERVICE_ROLE_KEY` (سرّي، للخادم فقط).

### ب. GitHub + Vercel
1. ارفع مجلد المشروع إلى مستودع GitHub (الملف `.gitignore` يمنع رفع `.env` و `node_modules`).
2. في [vercel.com](https://vercel.com): **Add New → Project** ← اختر المستودع.
   - Root Directory: جذر المستودع (`./`) — الإعدادات تُقرأ من `vercel.json` تلقائياً.
3. **Environment Variables** (انسخها من `.env.example`):

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | رابط Transaction pooler (6543) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح service_role |
| `SUPABASE_STORAGE_BUCKET` | `component-images` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://<project>.vercel.app` |
| `HACKATHON_END_AT` | موعد نهاية الهاكاثون مثل `2026-11-21T18:00:00+03:00` |
| `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` | حساب الأدمن الأول (كلمة مرور ≥ 12 حرفاً) |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | اختياري — لتفعيل المساعد الذكي |

4. **Deploy**. بعد انتهاء النشر افتح `https://<project>.vercel.app/admin` وسجّل الدخول بحساب الـ Bootstrap، ثم **احذف** متغيري `BOOTSTRAP_ADMIN_*` من Vercel.
5. من لوحة الإدارة ← **الحسابات** ← أنشئ حساباً لكل فريق وسلّم البيانات للفرق.

> اختبار سريع بعد النشر: `https://<project>.vercel.app/api/health` يجب أن يعيد `{"status":"ok"}`.

### ج. المساعد التقني (اختياري)
يعمل المساعد دائماً بوضع "بحث المخزون" (نتائج حقيقية من قاعدة البيانات). لتفعيل الاستشارات الذكية أضف مفتاحاً لأي مزود متوافق مع OpenAI Chat Completions:
- OpenAI: `AI_BASE_URL=https://api.openai.com/v1` و `AI_MODEL=gpt-4o-mini`
- Google Gemini (يملك خطة مجانية): `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai` و `AI_MODEL=gemini-2.0-flash`
المفتاح يبقى في الخادم فقط، والمساعد لا يملك أي صلاحية كتابة.

---

## 3) التشغيل محلياً

```bash
# PostgreSQL محلي أو Supabase
cp .env.example .env          # عدّل DATABASE_URL (للمحلي: postgresql://user:pass@localhost:5432/hamak)
npm install                   # يثبت تبعيات الخادم ويولّد Prisma Client
npm run db:migrate            # أو شغّل supabase/schema.sql على قاعدة فارغة
AUTH_USERNAME=admin AUTH_PASSWORD='ChangeMe12345' AUTH_ACCOUNT_TYPE=ADMIN npm run db:create-user
PORT=3000 npm run dev:api     # الخادم على :3000
npm --prefix frontend install && npm run dev:web   # الواجهة على :5173 (توجّه /api إلى :3000)
npm test                      # 38 اختباراً للخادم
```

بدون Supabase Storage محلياً تُحفظ الصور المرفوعة في `backend/uploads/components`.

---

## 4) قواعد العمل المطبّقة (من الخطة)

- طلب واحد فقط بحالة *قيد المراجعة* لكل فريق (قيد فريد جزئي في القاعدة)، ولا تعديل بعد الإرسال (Trigger)، والإلغاء قبل المراجعة فقط.
- الإرسال لا يحجز؛ **القبول** يحجز ضمن معاملة مع قفل الصفوف؛ **التسليم** يخصم من العامل؛ **الإرجاع** السليم يعود للعامل والعاطل يُسجَّل عاطلاً.
- `المتاح = العامل − المحجوز` ، `العهدة = المسلّم − (المعاد السليم + العاطل)` — تُحسب في الخادم فقط.
- حركات المخزون وسجل التدقيق إلحاقية لا تُعدَّل، وكل تعديل كمية يُسجّل كحركة.
- لا يجوز جعل العامل أقل من المحجوز، ولا إرجاع أكثر من العهدة، ولا حذف قطعة لها تاريخ (تُعطَّل).
- جلسة واحدة لحساب الفريق، والتجميد/إعادة كلمة المرور يبطلان الجلسات فوراً.
- التصفير: عبارة `DELETE DATA` + كلمة مرور الأدمن + شروط الإغلاق على الخادم + ملخص نهائي محفوظ.

تفاصيل قرارات الدمج والفروقات: `docs/integration-notes.md` — قائمة الـ API: `docs/api-contract.md`.
