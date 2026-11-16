// Thin fetch wrapper. The frontend and API share one origin (Vercel rewrites
// /api/* to the Express function), so the HttpOnly session cookie is sent
// automatically. The frontend never talks to the database directly.

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

const arabicErrors = [
  [/Invalid username or password/i, "اسم المستخدم أو كلمة المرور غير صحيحة."],
  [/Account is frozen/i, "هذا الحساب مجمّد. تواصل مع إدارة الهاكاثون."],
  [/already has an active session/i, "هذا الحساب مفتوح على جهاز آخر. سجّل الخروج منه أو اطلب من المشرف إنهاء الجلسة."],
  [/Too many login attempts/i, "محاولات دخول كثيرة. حاول مجدداً بعد قليل."],
  [/not assigned to an active team/i, "هذا الحساب غير مرتبط بفريق نشط."],
  [/session is invalid or expired|valid session is required/i, "انتهت الجلسة. سجّل الدخول من جديد."],
  [/Team already has a pending request/i, "لدى فريقك طلب قيد المراجعة بالفعل. انتظر قرار المشرف أو ألغِ الطلب الحالي."],
  [/One or more components are unavailable/i, "بعض القطع المختارة لم تعد متاحة."],
  [/Only pending requests can be cancelled/i, "يمكن إلغاء الطلب قبل مراجعته فقط."],
  [/Insufficient available quantity/i, "الكمية المتاحة لا تكفي لقبول الطلب."],
  [/Insufficient working stock/i, "المخزون العامل لا يكفي لهذا التسليم."],
  [/Delivery exceeds approved quantity/i, "الكمية المسلّمة تتجاوز الكمية المعتمدة."],
  [/Return exceeds delivered quantity/i, "كمية الإرجاع تتجاوز ما بعهدة الفريق."],
  [/Working quantity cannot be lower than the reserved/i, "لا يمكن جعل الكمية العاملة أقل من المحجوز."],
  [/Username is already taken/i, "اسم المستخدم مستخدم مسبقاً."],
  [/team already has an account/i, "لهذا الفريق حساب بالفعل."],
  [/Password must be at least/i, "كلمة المرور يجب أن تكون 8 أحرف على الأقل."],
  [/Username must be/i, "اسم المستخدم: 3-64 حرفاً لاتينياً صغيراً أو أرقاماً أو . _ -"],
  [/Only WEBP images|not a valid WEBP/i, "تعذّر رفع الصورة. اختر صورة صالحة (JPG/PNG/WEBP)."],
  [/Password verification failed/i, "كلمة المرور غير صحيحة."],
  [/Type DELETE DATA/i, "اكتب DELETE DATA حرفياً للتأكيد."],
  [/Close all pending/i, "أغلق كل الطلبات المعلقة والمعتمدة وغير المكتملة أولاً."],
  [/still hold/i, "ما زالت لدى الفرق قطع غير معادة. سجّل كل الإرجاعات أولاً."],
  [/cannot freeze your own/i, "لا يمكنك تجميد حسابك."],
  [/Request origin is not allowed|valid frontend origin/i, "تم رفض الطلب لأسباب أمنية (مصدر غير مسموح)."],
  [/Too many requests/i, "عدد كبير من المحاولات، حاول بعد قليل."],
  [/permission/i, "لا تملك صلاحية تنفيذ هذا الإجراء."],
];

export class ApiError extends Error {
  constructor(message, status, original) {
    super(message);
    this.status = status;
    this.original = original;
  }
}

function translate(message, status) {
  if (!message) return status >= 500 ? "حدث خطأ في الخادم. حاول مجدداً." : "تعذّر تنفيذ الطلب.";
  const match = arabicErrors.find(([pattern]) => pattern.test(message));
  if (match) return match[1];
  if (/[؀-ۿ]/.test(message)) return message;
  return status >= 500 ? "حدث خطأ في الخادم. حاول مجدداً." : message;
}

let unauthorizedHandler = null;
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function api(path, { method = "GET", body, form, signal, silent401 = false } = {}) {
  const options = { method, credentials: "include", headers: {}, signal };
  if (form) {
    options.body = form;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("تعذّر الاتصال بالخادم. تحقق من الإنترنت.", 0, error.message);
  }
  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    if (response.status === 401 && !silent401 && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(translate(data?.error, response.status), response.status, data?.error);
  }
  return data;
}

export const Api = {
  me: () => api("/auth/me", { silent401: true }),
  login: (username, password) => api("/auth/login", { method: "POST", body: { username, password }, silent401: true }),
  logout: () => api("/auth/logout", { method: "POST", silent401: true }),
  config: () => api("/config"),

  components: () => api("/components"),
  requests: (archived = false) => api(`/requests${archived ? "?archived=1" : ""}`),
  request: (id) => api(`/requests/${id}`),
  createRequest: (payload) => api("/requests", { method: "POST", body: payload }),
  cancelRequest: (id) => api(`/requests/${id}/cancel`, { method: "POST" }),
  custody: () => api("/team/custody"),

  chatStatus: () => api("/chat/status"),
  chat: (messages) => api("/chat/messages", { method: "POST", body: { messages } }),

  adminComponents: () => api("/admin/components"),
  createComponent: (payload) => api("/components", { method: "POST", body: payload }),
  updateComponent: (id, payload) => api(`/components/${id}`, { method: "PATCH", body: payload }),
  deleteComponent: (id) => api(`/components/${id}`, { method: "DELETE" }),
  uploadComponentImage: (id, file) => {
    const form = new FormData();
    form.append("image", file, "image.webp");
    return api(`/components/${id}/image`, { method: "POST", form });
  },

  approve: (id) => api(`/admin/requests/${id}/approve`, { method: "POST" }),
  reject: (id, note) => api(`/admin/requests/${id}/reject`, { method: "POST", body: note ? { note } : {} }),
  deliver: (id, items) => api(`/requests/${id}/deliveries`, { method: "POST", body: { items } }),
  recordReturn: (deliveryItemId, workingQuantity, brokenQuantity) =>
    api(`/deliveries/${deliveryItemId}/returns`, { method: "POST", body: { workingQuantity, brokenQuantity } }),
  outstanding: () => api("/admin/deliveries/outstanding"),

  dashboard: () => api("/admin/dashboard"),
  inventoryReport: () => api("/admin/reports/inventory"),
  custodyReport: () => api("/admin/reports/custody"),
  movements: (offset = 0, limit = 50) => api(`/admin/reports/movements?limit=${limit}&offset=${offset}`),
  auditLogs: (offset = 0, limit = 50) => api(`/admin/audit-logs?limit=${limit}&offset=${offset}`),

  users: (archived = false) => api(`/admin/users${archived ? "?archived=1" : ""}`),
  createUser: (payload) => api("/admin/users", { method: "POST", body: payload }),
  setUserStatus: (id, isActive) => api(`/admin/users/${id}/status`, { method: "PATCH", body: { isActive } }),
  resetPassword: (id, password) => api(`/admin/users/${id}/reset-password`, { method: "POST", body: { password } }),
  revokeSessions: (id) => api(`/admin/users/${id}/sessions/revoke`, { method: "POST" }),

  resetCheck: () => api("/admin/reset-hackathon-data/check"),
  resetHackathon: (confirmation, password) =>
    api("/admin/reset-hackathon-data", { method: "POST", body: { confirmation, password } }),
  summaries: () => api("/admin/hackathon-summaries"),
};
