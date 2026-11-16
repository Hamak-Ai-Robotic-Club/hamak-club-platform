export const nf = (value) => Number(value || 0).toLocaleString("ar-EG");

export function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export const requestStatusLabels = {
  Pending: "قيد المراجعة",
  Approved: "تمت الموافقة",
  "Partially Delivered": "تسليم جزئي",
  Delivered: "تم التسليم",
  Rejected: "مرفوض",
  Cancelled: "تم الإلغاء",
};

export const returnStatusLabels = {
  "Not Returned": "لم تُعد",
  "Partially Returned": "إرجاع جزئي",
  Returned: "أُعيدت بالكامل",
};

export const categoryLabels = {
  "Arduino Kit": "كيت أردوينو",
  "ESP32 Kit": "كيت ESP32",
};

export const categoryLabel = (category) => categoryLabels[category] || category;

export const movementLabels = {
  INITIAL_STOCK_IMPORT: "استيراد الجرد الأولي",
  INITIAL_STOCK: "رصيد افتتاحي",
  MANUAL_ADJUSTMENT: "تعديل يدوي",
  DELIVERY: "تسليم لفريق",
  RETURN_WORKING: "إرجاع سليم",
  RETURN_BROKEN: "إرجاع عاطل",
};

export const auditLabels = {
  COMPONENT_CREATED: "إضافة قطعة",
  COMPONENT_UPDATED: "تعديل قطعة",
  COMPONENT_DISABLED: "تعطيل قطعة",
  COMPONENT_DELETED: "حذف قطعة",
  COMPONENT_IMAGE_UPDATED: "تحديث صورة قطعة",
  REQUEST_APPROVED: "قبول طلب",
  REQUEST_REJECTED: "رفض طلب",
  REQUEST_DELIVERED: "تسليم قطع",
  DELIVERY_RETURNED: "تسجيل إرجاع",
  USER_CREATED: "إنشاء حساب",
  USER_FROZEN: "تجميد حساب",
  USER_UNFROZEN: "إعادة تفعيل حساب",
  USER_CREDENTIAL_RESET: "إعادة تعيين كلمة مرور",
  USER_SESSIONS_REVOKED: "إنهاء جلسات",
  HACKATHON_DATA_RESET: "تصفير بيانات الهاكاثون",
};

// Converts any picked image (JPG/PNG/WEBP...) to a resized WEBP in the browser,
// so the server keeps its strict "WEBP only" upload rule and files stay small.
export async function imageFileToWebp(file, maxSize = 900, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("تعذّر قراءة الصورة."));
      element.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") throw new Error("المتصفح لا يدعم تحويل الصور إلى WEBP.");
    return new File([blob], "image.webp", { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const builtInImages = [
  "arduino-uno", "arduino-cable", "breadboard", "lcd-16x2-display", "lcd-16x2-i2c", "potentiometer",
  "water-sensor", "sound-sensor", "dht11-sensor", "rfid-rc522-module", "relay-module", "sg90-servo-motor",
  "stepper-motor-driver", "membrane-keypad", "matrix-keypad-board", "joystick-module", "ir-remote-control",
  "led-dot-matrix-8x8", "7-segment-1-digit", "7-segment-2-digit", "rgb-led-module", "ldr-photoresistor",
  "ic-chips", "esp32-board", "micro-usb-cable", "jumper-wires-male-to-female", "jumper-wires-male-to-male",
  "jumper-wires-female-to-female", "header-connector", "pir-sensor", "colored-leds", "mpu6050-sensor",
  "ultrasonic-sensor", "dc-motor", "tactile-push-button", "lm35-temperature-sensor", "resistors",
  "electrolytic-capacitors", "ceramic-capacitors", "ir-sensor",
].map((name) => `/components/${name}.webp`);
