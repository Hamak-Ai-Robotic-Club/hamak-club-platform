import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Cpu,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Hourglass,
  LayoutDashboard,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Moon,
  Package,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";

function Brand({ inverse = false }) {
  return (
    <div className={`auth-brand ${inverse ? "auth-brand-inverse" : ""}`}>
      <img className="auth-brand-logo" src="/hmk-logo.png" alt="شعار نادي الهمك" />
      <span className="auth-brand-copy">
      <strong>نادي الهمك</strong>
        <small>للذكاء الصنعي والروبوتيك</small>
      </span>
    </div>
  );
}

function ThemeToggle({ theme, onToggle, compact = false }) {
  const isDark = theme === "dark";
  return (
    <button
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
      type="button"
      aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الليلي"}
      aria-pressed={isDark}
      onClick={onToggle}
      title={isDark ? "الوضع الفاتح" : "الوضع الليلي"}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{isDark ? "الوضع الفاتح" : "الوضع الليلي"}</span>}
    </button>
  );
}

const DEFAULT_HACKATHON_DURATION_HOURS = 72;

function getHackathonEndAt(email) {
  const configuredEnd = import.meta.env.VITE_HACKATHON_END_AT;
  if (configuredEnd) {
    const timestamp = Date.parse(configuredEnd);
    if (!Number.isFinite(timestamp)) throw new Error("VITE_HACKATHON_END_AT must be a valid date.");
    return timestamp;
  }

  const configuredDuration = import.meta.env.VITE_HACKATHON_DURATION_HOURS;
  const durationHours = configuredDuration ? Number(configuredDuration) : DEFAULT_HACKATHON_DURATION_HOURS;
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new Error("VITE_HACKATHON_DURATION_HOURS must be a positive number.");
  }

  const storageKey = `hmk-hackathon-end-at:${encodeURIComponent(email.trim().toLowerCase())}`;
  const savedEnd = localStorage.getItem(storageKey) || localStorage.getItem("hmk-hackathon-end-at");
  if (savedEnd) {
    const timestamp = Number(savedEnd);
    if (!Number.isFinite(timestamp)) throw new Error("Saved hackathon end time is invalid.");
    localStorage.setItem(storageKey, String(timestamp));
    return timestamp;
  }

  const timestamp = Date.now() + durationHours * 60 * 60 * 1000;
  localStorage.setItem(storageKey, String(timestamp));
  return timestamp;
}

function useHackathonRemaining(endAt) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endAt - Date.now()));
  useEffect(() => {
    function updateRemaining() {
      setRemaining(Math.max(0, endAt - Date.now()));
    }

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);
  return remaining;
}

function HackathonCountdown({ remaining }) {
  const expired = remaining === 0;
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className={`hackathon-countdown ${expired ? "countdown-finished" : ""}`} role="timer" aria-live="off" aria-label={expired ? "Time's Up!" : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}>
      {expired ? (
        <div className="countdown-expired-text" role="status">Time&apos;s Up!</div>
      ) : (
        <div className="countdown-display" dir="ltr">
          <Hourglass className="countdown-hourglass" size={29} strokeWidth={2.2} aria-hidden="true" />
          <time className="countdown-time">
            <span>{String(hours).padStart(2, "0")}</span><i>:</i>
            <span>{String(minutes).padStart(2, "0")}</span><i>:</i>
            <span key={totalSeconds} className="countdown-second">{String(seconds).padStart(2, "0")}</span>
          </time>
        </div>
      )}
    </div>
  );
}

function StoryPanel() {
  return (
    <section className="auth-story">
      <div className="auth-story-mesh" />
      <span className="auth-story-glow" />
      <header className="auth-story-header">
        <Brand inverse />
        <div className="auth-header-tools">
          <span className="auth-hackathon-tag" dir="ltr">HMK <i>HACKATHON</i></span>
        </div>
      </header>

      <div className="auth-story-content">
        <div className="auth-story-copy">
          <span className="auth-eyebrow"><Sparkles size={14} /> هاكاثون العتاد والابتكار</span>
          <h1>من فكرة<br />إلى إنجاز</h1>
          <p>فكرتك القادمة قد تصنع الفرق، ابدأ رحلتك وابتكر بلا حدود</p>
        </div>

        <div className="auth-visual" aria-hidden="true">
          <div className="auth-visual-orbit orbit-outer" />
          <div className="auth-visual-orbit orbit-inner" />
          <div className="auth-chip">
            <Cpu size={57} strokeWidth={1.05} />
            <span className="chip-pin pin-top" />
            <span className="chip-pin pin-bottom" />
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginForm({ onLogin, savedLogin, theme, onToggleTheme }) {
  const [email, setEmail] = useState(savedLogin?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [frozen, setFrozen] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFrozen(false);

    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور للمتابعة.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const role = normalizedEmail === "admin@hamak.club" ? "admin" : "user";
    onLogin({ email: email.trim(), role, remember });
  }

  return (
    <section className="auth-panel">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-form-wrap">
        <div className="auth-form-heading">
          <span className="auth-form-kicker"><span /> نادي الهمك للذكاء الصنعي والروبوتيك</span>
          <h2>دخول الهاكاثون</h2>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <CircleHelp size={17} /><span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="إغلاق"><X size={15} /></button>
          </div>
        )}
        {frozen && (
          <div className="auth-alert auth-alert-warning" role="status">
            <LockKeyhole size={17} />
            <span>تعذّر الدخول؟ تحقّق من بياناتك أو تواصل مع مشرف الهاكاثون.</span>
            <button type="button" onClick={() => setFrozen(false)} aria-label="إغلاق"><X size={15} /></button>
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">البريد الإلكتروني</label>
            <div className="auth-input" dir="ltr">
              <Mail size={17} />
              <input
                autoComplete="username"
                id="login-email"
                type="email"
                placeholder="name@hamak.club"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">كلمة المرور</label>
            <div className="auth-input" dir="ltr">
              <KeyRound size={17} />
              <input
                autoComplete="current-password"
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="auth-password-toggle"
                type="button"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="auth-form-options">
            <label className="auth-remember">
              <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              <span className="auth-checkbox"><Check size={12} /></span>
              تذكّرني
            </label>
          </div>

          <button className="auth-submit" type="submit">
            <span>دخول إلى الهاكاثون</span><ArrowLeft size={18} />
          </button>
        </form>

        <button className="auth-account-help" type="button" onClick={() => setFrozen(true)}>
          <CircleHelp size={16} /><span>مساعدة في الدخول</span>
        </button>
      </div>
    </section>
  );
}

const inventoryEnglishNames = {
  "ARD-001": "Arduino Uno Board",
  "ARD-CAB-001": "Arduino USB Cable",
  "ARD-BRD-001": "Solderless Breadboard",
  "ARD-LCD-001": "16x2 LCD Module with Wiring",
  "ARD-POT-001": "Rotary Potentiometer",
  "ARD-SNS-001": "Water Level Sensor",
  "ARD-SNS-002": "Sound Sensor",
  "ARD-SNS-003": "Humidity Sensor (DHT)",
  "ARD-SNS-004": "RFID Reader Module",
  "ARD-REL-001": "5V Relay Module",
  "MTR-008": "SG90 Servo Motor and Horns",
  "ARD-MTR-001": "28BYJ-48 Stepper Motor",
  "ARD-MTR-002": "ULN2003 Stepper Driver",
  "ARD-INP-001": "4x4 Matrix Keypad",
  "ARD-INP-002": "Joystick Module",
  "ARD-IR-001": "Infrared Remote Control",
  "ARD-REM-001": "Remote Controller (Battery Needed)",
  "ARD-DSP-001": "8x8 LED Matrix",
  "ARD-DSP-002": "Dual 7-Segment Display",
  "ARD-DSP-003": "Single 7-Segment Display",
  "ARD-RGB-001": "RGB LED",
  "ARD-LDR-001": "Light-Dependent Resistor (LDR)",
  "ARD-TMR-001": "NE555 Timer IC",
  "ESP-BRD-001": "ESP32 Development Board",
  "ESP-CAB-001": "Micro-USB Cable",
  "ESP-WIR-FM-001": "Female-to-Male Jumper Wires",
  "ESP-WIR-MM-001": "Male-to-Male Jumper Wires",
  "ESP-BRD-002": "Solderless Breadboard",
  "ESP-CON-001": "3-Pin Header Connector",
  "ESP-WIR-SER-001": "Serial Jumper Wires",
  "ESP-SNS-MOV-001": "PIR Motion Sensor",
  "ESP-LED-001": "LEDs",
  "ESP-LCD-001": "16x2 LCD Module",
  "ESP-POT-001": "Rotary Potentiometer",
  "ESP-SNS-GYR-001": "Gyroscope Module",
  "SNS-014": "HC-SR04 Ultrasonic Sensor",
  "MTR-011": "DC Motor",
  "ESP-MTR-001": "SG90 Servo Motor",
  "ESP-INP-001": "Matrix Keypad",
  "ESP-INP-002": "Tactile Push Button",
  "ESP-TR-2222A": "2N2222A NPN Transistor",
  "ESP-TR-BC516": "BC516 PNP Darlington Transistor",
  "ESP-IC-MCP9700E": "MCP9700 Temperature Sensor",
  "ESP-IC-JC2907A": "JC29 07A Integrated Circuit",
  "ESP-RES-001": "Assorted Resistors",
  "ESP-CAP-ELE-001": "Electrolytic Capacitor",
  "ESP-CAP-CER-001": "Ceramic Capacitor",
  "ESP-DSP-001": "Dual 7-Segment Display",
  "ESP-LDR-001": "Light-Dependent Resistor (LDR)",
  "ESP-REG-LD33CV": "LD33CV Voltage Regulator",
  "ESP-DRV-L9110H": "L9110H Motor Driver",
  "ESP-SNS-IR-001": "Infrared Receiver Sensor",
};

const inventoryImagePaths = {
  "ARD-001": "/components/arduino.jpg",
  "ARD-CAB-001": "/components/usb-ab-cable.jpg",
  "ARD-BRD-001": "/components/breadboard.jpg",
  "ARD-LCD-001": "/components/lcd-1602.jpg",
  "ARD-POT-001": "/components/potentiometer.jpg",
  "ARD-SNS-001": "/components/water-sensor.jpg",
  "ARD-SNS-002": "/components/microphone.jpg",
  "ARD-SNS-003": "/components/dht11.jpg",
  "ARD-SNS-004": "/components/rfid-rc522.jpg",
  "ARD-REL-001": "/components/relay-module.jpg",
  "MTR-008": "/components/servo-sg90.jpg",
  "ARD-MTR-001": "/components/stepper-motor.jpg",
  "ARD-MTR-002": "/components/stepper-driver.jpg",
  "ARD-INP-001": "/components/keypad.JPG",
  "ARD-INP-002": "/components/joystick.jpg",
  "ARD-IR-001": "/components/ir-remote.jpg",
  "ARD-REM-001": "/components/ir-remote.jpg",
  "ARD-DSP-001": "/components/led-matrix-8x8.png",
  "ARD-DSP-002": "/components/seven-segment.jpg",
  "ARD-DSP-003": "/components/seven-segment.jpg",
  "ARD-RGB-001": "/components/rgb-led.png",
  "ARD-LDR-001": "/components/ldr.jpg",
  "ARD-TMR-001": "/components/timer-ic.jpg",
  "ESP-BRD-001": "/components/esp32-board.jpg",
  "ESP-CAB-001": "/components/micro-usb.jpg",
  "ESP-WIR-FM-001": "/components/jumper-wires.jpg",
  "ESP-WIR-MM-001": "/components/jumper-wires.jpg",
  "ESP-BRD-002": "/components/breadboard.jpg",
  "ESP-CON-001": "/components/header-connector.jpg",
  "ESP-WIR-SER-001": "/components/jumper-wires.jpg",
  "ESP-SNS-MOV-001": "/components/pir-sensor.jpg",
  "ESP-LED-001": "/components/led.jpg",
  "ESP-LCD-001": "/components/lcd-1602.jpg",
  "ESP-POT-001": "/components/potentiometer.jpg",
  "ESP-SNS-GYR-001": "/components/gyro-sensor.jpg",
  "SNS-014": "/components/ultrasonic.jpg",
  "MTR-011": "/components/dc-motor-photo.jpg",
  "ESP-MTR-001": "/components/servo-sg90.jpg",
  "ESP-INP-001": "/components/keypad.JPG",
  "ESP-INP-002": "/components/push-button.jpg",
  "ESP-TR-2222A": "/components/transistor.jpg",
  "ESP-TR-BC516": "/components/transistor.jpg",
  "ESP-IC-MCP9700E": "/components/dht11.jpg",
  "ESP-IC-JC2907A": "/components/timer-ic.jpg",
  "ESP-RES-001": "/components/resistor.jpg",
  "ESP-CAP-ELE-001": "/components/electrolytic-capacitor.jpg",
  "ESP-CAP-CER-001": "/components/ceramic-capacitor.jpg",
  "ESP-DSP-001": "/components/seven-segment.jpg",
  "ESP-LDR-001": "/components/ldr.jpg",
  "ESP-REG-LD33CV": "/components/transistor.jpg",
  "ESP-DRV-L9110H": "/components/stepper-driver.jpg",
  "ESP-SNS-IR-001": "/components/ir-receiver.jpg",
};

function inventoryItem(id, name, category, quantity, source, options = {}) {
  return {
    id,
    name,
    nameEn: inventoryEnglishNames[id],
    category,
    quantity: options.availableQuantity ?? quantity,
    totalQuantity: quantity,
    image: options.image || inventoryImagePaths[id],
    icon: options.icon || Boxes,
    tone: options.tone || "mint",
    description: options.description || `الكمية حسب الجرد الفعلي لـ${source}.`,
  };
}

const inventorySeed = [
  inventoryItem("ARD-001", "لوحة أردوينو", "لوحات تحكم", 9, "كيتات Arduino", { image: "/components/arduino.jpg", icon: Cpu, tone: "mint", description: "لوحة تحكم إلكترونية. الكمية مأخوذة من الإجمالي الفعلي في جرد Arduino." }),
  inventoryItem("ARD-CAB-001", "كبل/وصلة أردوينو", "ملحقات", 9, "كيتات Arduino", { icon: Boxes, tone: "sky" }),
  inventoryItem("ARD-BRD-001", "لوحة تجارب (Breadboard)", "لوحات تجارب", 9, "كيتات Arduino", { icon: Cpu, tone: "blue" }),
  inventoryItem("ARD-LCD-001", "شاشة LCD مع وصلاتها — Arduino", "شاشات", 10, "كيتات Arduino", { icon: Boxes, tone: "violet" }),
  inventoryItem("ARD-POT-001", "مقاومة متغيرة — Arduino", "مكونات إلكترونية", 9, "كيتات Arduino", { icon: Settings2, tone: "amber" }),
  inventoryItem("ARD-SNS-001", "حساس منسوب المياه", "حساسات", 10, "كيتات Arduino", { icon: Settings2, tone: "blue" }),
  inventoryItem("ARD-SNS-002", "حساس صوت", "حساسات", 9, "كيتات Arduino", { icon: Settings2, tone: "rose" }),
  inventoryItem("ARD-SNS-003", "حساس رطوبة الجو", "حساسات", 4, "كيتات Arduino", { icon: Settings2, tone: "sky" }),
  inventoryItem("ARD-SNS-004", "قارئ/حساس RFID", "حساسات", 10, "كيتات Arduino", { icon: Settings2, tone: "violet" }),
  inventoryItem("ARD-REL-001", "ريليه (Relay)", "مكونات إلكترونية", 10, "كيتات Arduino", { icon: Boxes, tone: "rose" }),
  inventoryItem("MTR-008", "محرك سيرفو مع الشفرات — Arduino", "محركات", 7, "كيتات Arduino", { image: "/components/servo-sg90.jpg", icon: ArrowLeft, tone: "amber" }),
  inventoryItem("ARD-MTR-001", "محرك خطوي (Stepper)", "محركات", 8, "كيتات Arduino", { icon: ArrowUpLeft, tone: "sky" }),
  inventoryItem("ARD-MTR-002", "دارة قيادة لمحركات Stepper", "مكونات إلكترونية", 11, "كيتات Arduino", { icon: Boxes, tone: "violet" }),
  inventoryItem("ARD-INP-001", "لوحة مفاتيح Matrix 4×4", "إدخال وتحكم", 10, "كيتات Arduino", { icon: Boxes, tone: "mint" }),
  inventoryItem("ARD-INP-002", "عصا تحكم (Joystick)", "إدخال وتحكم", 8, "كيتات Arduino", { icon: Settings2, tone: "blue" }),
  inventoryItem("ARD-IR-001", "ريموت أشعة تحت الحمراء (IR)", "إدخال وتحكم", 10, "كيتات Arduino", { icon: Boxes, tone: "rose" }),
  inventoryItem("ARD-REM-001", "جهاز تحكم", "إدخال وتحكم", 10, "كيتات Arduino", { icon: Boxes, tone: "amber", availableQuantity: 9, description: "الجرد يسجل 10 قطع؛ إحداها تحتاج إلى بطارية، لذلك المتاح حاليًا 9." }),
  inventoryItem("ARD-DSP-001", "مصفوفة ليدات 8×8", "شاشات", 10, "كيتات Arduino", { icon: Boxes, tone: "mint" }),
  inventoryItem("ARD-DSP-002", "شاشة 7-Segment مزدوجة — Arduino", "شاشات", 10, "كيتات Arduino", { icon: Boxes, tone: "blue" }),
  inventoryItem("ARD-DSP-003", "شاشة 7-Segment مفردة", "شاشات", 9, "كيتات Arduino", { icon: Boxes, tone: "sky" }),
  inventoryItem("ARD-RGB-001", "وحدة RGB", "مكونات إلكترونية", 11, "كيتات Arduino", { icon: Boxes, tone: "rose" }),
  inventoryItem("ARD-LDR-001", "مقاومة ضوئية LDR — Arduino", "حساسات", 22, "كيتات Arduino", { icon: Settings2, tone: "amber" }),
  inventoryItem("ARD-TMR-001", "مؤقت (Timer)", "مكونات إلكترونية", 10, "كيتات Arduino", { icon: Boxes, tone: "violet" }),

  inventoryItem("ESP-BRD-001", "لوحة ESP32", "لوحات تحكم", 12, "كيتات ESP32", { icon: Cpu, tone: "mint" }),
  inventoryItem("ESP-CAB-001", "كبل Micro USB — ESP32", "ملحقات", 12, "كيتات ESP32", { icon: Boxes, tone: "sky" }),
  inventoryItem("ESP-WIR-FM-001", "أسلاك F-M", "أسلاك وتوصيلات", 240, "كيتات ESP32", { icon: Boxes, tone: "blue" }),
  inventoryItem("ESP-WIR-MM-001", "أسلاك M-M", "أسلاك وتوصيلات", 120, "كيتات ESP32", { icon: Boxes, tone: "violet" }),
  inventoryItem("ESP-BRD-002", "لوحة تجارب — ESP32", "لوحات تجارب", 11, "كيتات ESP32", { icon: Cpu, tone: "blue" }),
  inventoryItem("ESP-CON-001", "وصلة ثلاثية", "أسلاك وتوصيلات", 12, "كيتات ESP32", { icon: Boxes, tone: "amber" }),
  inventoryItem("ESP-WIR-SER-001", "أسلاك Serial", "أسلاك وتوصيلات", 96, "كيتات ESP32", { icon: Boxes, tone: "sky" }),
  inventoryItem("ESP-SNS-MOV-001", "حساس حركة — ESP32", "حساسات", 12, "كيتات ESP32", { icon: Settings2, tone: "rose" }),
  inventoryItem("ESP-LED-001", "LED", "مكونات إلكترونية", 240, "كيتات ESP32", { icon: Boxes, tone: "mint" }),
  inventoryItem("ESP-LCD-001", "شاشة LCD صغيرة — ESP32", "شاشات", 12, "كيتات ESP32", { icon: Boxes, tone: "violet" }),
  inventoryItem("ESP-POT-001", "مقاومة متغيرة — ESP32", "مكونات إلكترونية", 12, "كيتات ESP32", { icon: Settings2, tone: "amber" }),
  inventoryItem("ESP-SNS-GYR-001", "حساس جيروسكوب (Gyro)", "حساسات", 12, "كيتات ESP32", { icon: Settings2, tone: "blue" }),
  inventoryItem("SNS-014", "حساس الموجات فوق الصوتية", "حساسات", 12, "كيتات ESP32", { image: "/components/ultrasonic.jpg", icon: Settings2, tone: "blue", description: "لقياس المسافات واستشعار العوائق. العدد محسوب من كيتات ESP32." }),
  inventoryItem("MTR-011", "محرك تيار مستمر — ESP32", "محركات", 11, "كيتات ESP32", { image: "/components/dc-motor-photo.jpg", icon: ArrowUpLeft, tone: "sky" }),
  inventoryItem("ESP-MTR-001", "محرك سيرفو — ESP32", "محركات", 11, "كيتات ESP32", { image: "/components/servo-sg90.jpg", icon: ArrowLeft, tone: "amber" }),
  inventoryItem("ESP-INP-001", "لوحة مفاتيح — ESP32", "إدخال وتحكم", 11, "كيتات ESP32", { icon: Boxes, tone: "mint" }),
  inventoryItem("ESP-INP-002", "زر ضغط (Push Button)", "إدخال وتحكم", 6, "كيتات ESP32", { icon: Boxes, tone: "rose" }),
  inventoryItem("ESP-TR-2222A", "مكوّن 2222 A", "مكونات إلكترونية", 48, "كيتات ESP32", { icon: Boxes, tone: "amber" }),
  inventoryItem("ESP-TR-BC516", "مكوّن BC516", "مكونات إلكترونية", 24, "كيتات ESP32", { icon: Boxes, tone: "violet" }),
  inventoryItem("ESP-IC-MCP9700E", "مكوّن MCP 9700E", "مكونات إلكترونية", 22, "كيتات ESP32", { icon: Boxes, tone: "blue" }),
  inventoryItem("ESP-IC-JC2907A", "مكوّن JC29 07A", "مكونات إلكترونية", 24, "كيتات ESP32", { icon: Boxes, tone: "sky" }),
  inventoryItem("ESP-RES-001", "مقاومة", "مكونات إلكترونية", 324, "كيتات ESP32", { icon: Boxes, tone: "rose" }),
  inventoryItem("ESP-CAP-ELE-001", "مكثف كيميائي", "مكونات إلكترونية", 24, "كيتات ESP32", { icon: Boxes, tone: "amber" }),
  inventoryItem("ESP-CAP-CER-001", "مكثف سيراميكي", "مكونات إلكترونية", 72, "كيتات ESP32", { icon: Boxes, tone: "mint" }),
  inventoryItem("ESP-DSP-001", "شاشة 7-Segment مزدوجة — ESP32", "شاشات", 11, "كيتات ESP32", { icon: Boxes, tone: "blue" }),
  inventoryItem("ESP-LDR-001", "مقاومة ضوئية LDR — ESP32", "حساسات", 48, "كيتات ESP32", { icon: Settings2, tone: "amber" }),
  inventoryItem("ESP-REG-LD33CV", "مكوّن LD33CV", "مكونات إلكترونية", 12, "كيتات ESP32", { icon: Boxes, tone: "violet" }),
  inventoryItem("ESP-DRV-L9110H", "دارة قيادة L9110H", "مكونات إلكترونية", 11, "كيتات ESP32", { icon: Boxes, tone: "sky" }),
  inventoryItem("ESP-SNS-IR-001", "حساس أشعة تحت الحمراء (IR)", "حساسات", 12, "كيتات ESP32", { icon: Settings2, tone: "rose" }),
];

const requestSeed = [];

const inventoryPages = [
  { id: "overview", label: "لوحة التحكم", icon: LayoutDashboard, adminOnly: true },
  { id: "catalog", label: "كتالوج القطع", icon: Boxes },
  { id: "new-request", label: "طلب جديد", icon: Plus },
  { id: "requests", label: "طلباتي", icon: FileText },
  { id: "custody", label: "العهدة", icon: Package },
];

function InventoryStatus({ statusKey, children }) {
  const classes = {
    Pending: "status-pending",
    Approved: "status-approved",
    Delivered: "status-delivered",
    Rejected: "status-rejected",
    Cancelled: "status-cancelled",
    ReturnPending: "status-return-pending",
    Returned: "status-returned",
  };
  return <span className={`status-badge ${classes[statusKey] || ""}`}>{children}</span>;
}

function InventorySidebar({ account, active, onNavigate, onLogout, open, onClose, requestLock }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    function dismissProfile(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !profileRef.current?.contains(event.target))) {
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", dismissProfile);
    window.addEventListener("pointerdown", dismissProfile);
    return () => {
      window.removeEventListener("keydown", dismissProfile);
      window.removeEventListener("pointerdown", dismissProfile);
    };
  }, []);
  return (
    <>
      {open && <button className="mobile-backdrop" onClick={onClose} aria-label="إغلاق القائمة" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-lockup"><Brand /></div>
          <button className="sidebar-close" onClick={onClose} aria-label="إغلاق القائمة"><X size={18} /></button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">{account.role === "admin" ? "م" : "ن"}</span>
          <span className="workspace-label"><strong>{account.role === "admin" ? "إدارة النادي" : "فريق النخبة"}</strong><small>{account.role === "admin" ? "حساب مشرف" : "حساب فريق"}</small></span>
          <ChevronDown size={16} className="workspace-chevron" />
        </div>
        <span className="nav-section-label">{account.role === "admin" ? "إدارة المنصة" : "مساحة العمل"}</span>
        <nav className="side-nav" aria-label="القائمة الرئيسية">
          {inventoryPages.filter(({ id, adminOnly }) => account.role === "admin" ? adminOnly || id === "requests" : !adminOnly && id !== "warehouse").map(({ id, label, icon: Icon }) => {
            const requestDisabled = id === "new-request" && Boolean(requestLock);
            return <button key={label} className={`nav-link ${active === id ? "nav-link-active" : ""} ${requestDisabled ? "nav-link-disabled" : ""}`} aria-current={active === id ? "page" : undefined} aria-disabled={requestDisabled} title={requestDisabled ? (requestLock.statusKey === "Pending" ? "لديك طلب قيد المراجعة" : "سبق قبول طلب للفريق") : undefined} onClick={() => { if (!requestDisabled) { onNavigate(id); onClose(); } }}>
              <Icon size={18} /><span>{id === "requests" && account.role === "admin" ? "طلبات الفرق" : label}</span>
            </button>
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-profile" ref={profileRef}>
          {profileOpen && <section className="profile-popover" aria-label="الملف الشخصي">
            <span className="profile-popover-kicker">الملف الشخصي</span>
            <strong>{account.role === "admin" ? "مشرف النادي" : "حساب الفريق"}</strong>
            <span className="profile-popover-email" dir="ltr">{account.email}</span>
            <button type="button" className="profile-logout" onClick={onLogout}><LogOut size={16} /> تسجيل الخروج</button>
          </section>}
          <button className="sidebar-footer" aria-expanded={profileOpen} aria-label="عرض الملف الشخصي" onClick={() => setProfileOpen((current) => !current)}>
            <span className="avatar avatar-small">{account.role === "admin" ? "م" : "ف"}</span>
            <span className="profile-label"><strong>الملف الشخصي</strong></span>
            <ChevronDown size={16} className={profileOpen ? "profile-chevron-open" : ""} />
          </button>
        </div>
      </aside>
    </>
  );
}

function InventoryTopbar({ title, subtitle, account, notifications, cartCount, cartOpen, onMenu, onSearch, onOpenRequests, onCartToggle, theme, onToggleTheme, remaining }) {
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInput = useRef(null);

  useEffect(() => {
    function focusSearch(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu} aria-label="فتح القائمة"><Menu size={21} /></button>
      <div className="page-heading"><span className="breadcrumb">مساحة العمل <ChevronLeft size={13} /> {title}</span><h1>{title}</h1><span className="topbar-subtitle">{subtitle}</span></div>
      <div className="topbar-actions">
        <HackathonCountdown remaining={remaining} />
        <label className="global-search"><Search size={16} /><input ref={searchInput} aria-label="ابحث عن قطعة في الكتالوج" placeholder="ابحث عن قطعة..." value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) onSearch(query.trim()); }} /><kbd dir="ltr">⌘ K</kbd></label>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
        <div className="notification-wrap">
          <button className="icon-button notification-button" aria-label="الإشعارات" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
            <Bell size={18} />
            {notifications.length > 0 && <span className="notification-count" dir="ltr">{notifications.length}</span>}
          </button>
          {notificationsOpen && (
            <section className="notification-menu" aria-label="إشعارات الفريق">
              <div className="notification-menu-heading"><strong>إشعارات الفريق</strong><span>{notifications.length}</span></div>
              {notifications.length ? notifications.slice(0, 4).map((notification) => (
                <button className="notification-item" key={notification.id} onClick={() => { setNotificationsOpen(false); onOpenRequests(); }}>
                  <span className="notification-item-dot" />
                  <span><strong>{notification.project}</strong><small>{notification.returnStatus === "Pending" ? "الفريق يطلب إعادة القطع — بانتظار تأكيدك" : "طلب جديد بانتظار مراجعة المشرف"}</small></span>
                  <ChevronLeft size={15} />
                </button>
              )) : <p className="notification-empty">لا توجد إشعارات جديدة.</p>}
            </section>
          )}
        </div>
        {account.role !== "admin" && <button className="theme-toggle theme-toggle-compact cart-button" aria-label={cartOpen ? "إغلاق سلة القطع" : `فتح سلة القطع، ${cartCount} قطعة`} aria-expanded={cartOpen} onClick={onCartToggle}>
          <ShoppingCart size={18} />
          {cartCount > 0 && <span className="cart-count" dir="ltr">{cartCount}</span>}
        </button>}
      </div>
    </header>
  );
}

function InventoryCartSidebar({ open, items, selectedItems, quantities, onClose, onRemove, onContinue }) {
  const selected = items.filter((item) => selectedItems.includes(item.id));
  if (!open) return null;

  return (
    <div className="cart-drawer-layer">
      <button className="cart-backdrop" onClick={onClose} aria-label="إغلاق سلة القطع" />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
        <header className="cart-drawer-header">
          <div><span className="cart-drawer-kicker">طلبك الحالي</span><h2 id="cart-drawer-title">سلة القطع <span dir="ltr">{selected.length}</span></h2></div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق السلة"><X size={18} /></button>
        </header>
        {selected.length ? (
          <>
            <div className="cart-drawer-items">
              {selected.map((item) => (
                <article className="cart-drawer-item" key={item.id}>
                  {item.image ? <img src={item.image} alt="" /> : <span className={`cart-item-placeholder tone-${item.tone}`}><item.icon size={22} /></span>}
                  <span className="cart-drawer-item-copy"><strong>{item.name}</strong><small className="item-name-en" dir="ltr">{item.nameEn}</small><small className="cart-item-id" dir="ltr">{item.id}</small><small>الكمية: <b dir="ltr">{quantities[item.id] || 1}</b></small></span>
                  <button className="cart-remove-button" onClick={() => onRemove(item.id)} aria-label={`حذف ${item.name} من السلة`}><X size={15} /></button>
                </article>
              ))}
            </div>
            <button className="button-primary cart-continue-button" onClick={onContinue}>متابعة الطلب <ArrowLeft size={16} /></button>
          </>
        ) : (
          <div className="cart-empty-state"><ShoppingCart size={27} /><strong>سلتك فارغة حاليًا</strong><span>أضف قطعًا من الكتالوج للبدء بطلبك.</span><button onClick={onContinue}>استكشف القطع <ArrowLeft size={15} /></button></div>
        )}
      </aside>
    </div>
  );
}

function InventoryComponentCard({ item, onAdd, added, quantity = 1, onQuantityChange, requestLocked = false }) {
  const Icon = item.icon || Boxes;
  const unavailable = item.quantity === 0 || requestLocked;
  function changeQuantity(value) {
    if (!onQuantityChange) return;
    const nextQuantity = Number(value);
    onQuantityChange(item.id, Math.min(item.quantity, Math.max(1, Number.isFinite(nextQuantity) ? Math.floor(nextQuantity) : 1)));
  }

  return (
    <article className="component-card">
      <div className={`component-image tone-${item.tone} ${item.photo ? "component-image-photo" : ""}`}>
        {item.image ? <img src={item.image} alt={`${item.name} / ${item.nameEn}`} loading="lazy" /> : <span className="component-image-placeholder"><Icon size={48} strokeWidth={1.35} /></span>}
        <span className="component-image-overlay" />
        <span className="component-category">{item.category}</span>
        {item.quantity === 0 && <span className="out-of-stock">نفد المخزون</span>}
      </div>
      <div className="component-body">
        <div className="component-title-row"><div><h3>{item.name}</h3><span className="component-name-en" dir="ltr">{item.nameEn}</span><span dir="ltr" className="component-id">{item.id}</span></div><span className={`component-stock-state ${item.quantity > 0 ? "is-working" : "is-unavailable"}`}><i className={`stock-dot ${item.quantity > 5 ? "in-stock" : item.quantity > 0 ? "low-stock" : "no-stock"}`} /><span>{item.quantity > 0 ? "متاح" : "غير متوفر"}</span></span></div>
        <p className="component-description">{item.description}</p>
        <div className="component-footer">
          <span className="quantity-label">المتاح <strong dir="ltr">{item.quantity}</strong> قطع</span>
          <div className="component-purchase-controls">
            <div className="component-quantity-control" role="group" aria-label={`كمية ${item.name}`}>
              <button type="button" aria-label={`تقليل كمية ${item.name}`} disabled={unavailable || quantity <= 1} onClick={() => changeQuantity(quantity - 1)}>−</button>
              <input type="number" min="1" max={item.quantity} step="1" value={quantity} aria-label={`الكمية المطلوبة من ${item.name}`} disabled={unavailable} onChange={(event) => changeQuantity(event.target.value)} />
              <button type="button" aria-label={`زيادة كمية ${item.name}`} disabled={unavailable || quantity >= item.quantity} onClick={() => changeQuantity(quantity + 1)}>+</button>
            </div>
            <button className={`add-component ${added ? "added-component" : ""}`} disabled={item.quantity === 0 || added || requestLocked} onClick={() => onAdd(item, quantity)} aria-label={requestLocked ? `لا يمكن طلب ${item.name} قبل إغلاق الطلب الحالي` : added ? `${item.name} في السلة` : `إضافة ${item.name} إلى السلة`}>
            {added ? <Check size={16} /> : <Plus size={16} />}
            <span>{added ? "في السلة" : "أضف للسلة"}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InventoryRequestTable({ requests, account, onCancel, onOpen, onApprove, onReject, onApproveReturn }) {
  const canCancel = account.role !== "admin";
  return (
    <div className="table-scroll"><table className="requests-table"><thead><tr><th>رقم الطلب</th>{!canCancel && <th>الفريق</th>}<th>المشروع</th><th>تاريخ التقديم</th><th>القطع</th>{!canCancel && <th>الأعضاء</th>}<th>الحالة</th><th>الإجراء</th></tr></thead>
      <tbody>{requests.map((request) => (
        <tr key={request.id}>
          <td><button className="table-id" dir="ltr" onClick={() => onOpen(request)}>{request.id}</button></td>
          {!canCancel && <td className="request-team-email">{request.teamEmail ? <span dir="ltr">{request.teamEmail}</span> : "غير محدد"}</td>}
          <td><button className="table-project" onClick={() => onOpen(request)}>{request.project}</button></td>
          <td className="table-date">{request.date}</td>
          <td><span className="item-count">{request.lines.length} أنواع</span></td>
          {!canCancel && <td><span className="item-count">{Array.isArray(request.members) ? request.members.length : 0} أسماء</span></td>}
          <td><InventoryStatus statusKey={request.returnStatus === "Pending" ? "ReturnPending" : request.statusKey}>{request.returnStatus === "Pending" ? "طلب إعادة القطع" : request.status}</InventoryStatus></td>
          <td>
            {canCancel && request.statusKey === "Pending" ? <button className="cancel-request" onClick={() => onCancel(request.id)}>إلغاء الطلب</button> : canCancel && request.returnStatus === "Pending" ? <span className="return-pending-note">بانتظار تأكيد المشرف</span> : !canCancel && request.returnStatus === "Pending" ? (
              <div className="request-row-actions">
                <button className="admin-approve-row" onClick={() => onApproveReturn(request.id)}>تأكيد استلام القطع</button>
                <button className="row-action" aria-label={`عرض طلب إعادة القطع ${request.id}`} onClick={() => onOpen(request)}><Eye size={16} /></button>
              </div>
            ) : !canCancel && request.statusKey === "Pending" ? (
              <div className="request-row-actions">
                <button className="admin-approve-row" onClick={() => onApprove(request.id)}>قبول الطلب</button>
                <button className="admin-reject-row" onClick={() => onReject(request.id)}>رفض الطلب</button>
                <button className="row-action" aria-label={`مراجعة تفاصيل الطلب ${request.id}`} onClick={() => onOpen(request)}><Eye size={16} /></button>
              </div>
            ) : <button className="row-action" aria-label={`عرض الطلب ${request.id}`} onClick={() => onOpen(request)}><ChevronLeft size={17} /></button>}
          </td>
        </tr>
      ))}</tbody></table></div>
  );
}

function InventoryOverview({ items, requests, account, selectedItems, onNavigate, onAdd, onCancel, onOpen, onApproveReturn }) {
  const availableCount = items.reduce((total, item) => total + item.quantity, 0);
  const pendingCount = requests.filter((request) => request.statusKey === "Pending").length;
  const approvedQuantity = requests
    .filter((request) => ["Approved", "Delivered"].includes(request.statusKey))
    .flatMap((request) => request.lines)
    .reduce((total, line) => total + line.quantity, 0);
  return (
    <div className="page-content">
      <section className="welcome-banner"><div className="welcome-copy"><span className="welcome-kicker"><span className="live-dot" /> {account.role === "admin" ? "لوحة النادي" : "لوحة فريقك"}</span><h2>{account.role === "admin" ? "مرحبًا بك في مساحة النادي" : "مساء الابتكار، أحمد"} <span>✦</span></h2><p>تصفّح المخزون، تابع الطلبات، واستعد لمشروعك القادم.</p><div className="welcome-actions"><button className="button-primary" onClick={() => onNavigate(account.role === "admin" ? "requests" : "new-request")}>{account.role === "admin" ? <FileText size={17} /> : <Plus size={17} />} {account.role === "admin" ? "عرض طلبات الفرق" : "طلب قطع لمشروعك"}</button><button className="welcome-secondary" onClick={() => onNavigate("catalog")}>استكشف الكتالوج <ArrowLeft size={16} /></button></div></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="welcome-chip"><Cpu size={57} strokeWidth={1.1} /></div><span className="float-dot dot-a" /><span className="float-dot dot-b" /><div className="welcome-art-label"><Sparkles size={14} /> حوّل فكرتك إلى واقع</div></div><span className="banner-grain" /></section>
      <section className="stats-grid">
        <article className="stat-card"><span className="stat-icon stat-red"><FileText size={19} /></span><span className="stat-content"><span>إجمالي الطلبات</span><strong>{requests.length.toLocaleString("ar-EG")}</strong><small>طلبات مسجلة في النظام</small></span><MoreHorizontal className="stat-dots" size={19} /></article>
        <article className="stat-card"><span className="stat-icon stat-amber"><Clock3 size={19} /></span><span className="stat-content"><span>قيد المراجعة</span><strong>{pendingCount.toLocaleString("ar-EG")}</strong><small>بانتظار مراجعة المشرف</small></span><MoreHorizontal className="stat-dots" size={19} /></article>
        <article className="stat-card"><span className="stat-icon stat-blue"><Package size={19} /></span><span className="stat-content"><span>قطع معتمدة</span><strong>{approvedQuantity.toLocaleString("ar-EG")}</strong><small>ضمن طلبات وافق عليها المشرف</small></span><MoreHorizontal className="stat-dots" size={19} /></article>
        <article className="stat-card"><span className="stat-icon stat-green"><Boxes size={19} /></span><span className="stat-content"><span>قطع متاحة</span><strong>{availableCount.toLocaleString("ar-EG")}</strong><small>من مكونات الكتالوج</small></span><MoreHorizontal className="stat-dots" size={19} /></article>
      </section>
      <section className="section-block"><div className="section-heading"><div><span className="section-eyebrow">مخزون النادي</span><h2>قطع متاحة لك <span className="heading-count">٠٦</span></h2></div><button className="subtle-link" onClick={() => onNavigate("catalog")}>عرض الكتالوج <ArrowLeft size={15} /></button></div><div className="component-grid overview-components">{items.slice(0, 3).map((item) => <InventoryComponentCard key={item.id} item={item} onAdd={onAdd} added={selectedItems.includes(item.id)} />)}</div></section>
      <section className="section-block recent-section"><div className="section-heading"><div><span className="section-eyebrow">آخر التحديثات</span><h2>{account.role === "admin" ? "طلبات الفرق" : "طلبات فريقك"}</h2></div><button className="subtle-link" onClick={() => onNavigate("requests")}>كل الطلبات <ArrowLeft size={15} /></button></div><div className="panel"><InventoryRequestTable requests={requests.slice(0, 3)} account={account} onCancel={onCancel} onOpen={onOpen} onApproveReturn={onApproveReturn} /></div></section>
      <footer className="page-footer"><span>© ٢٠٢٥ نادي الهمك للذكاء الصنعي والروبوتيك</span><span>إدارة موارد الفرق والمشاريع</span></footer>
    </div>
  );
}

function getAdminInventorySummary(items, requests) {
  const reservedByItem = requests
    .filter((request) => ["Pending", "Approved"].includes(request.statusKey))
    .flatMap((request) => request.lines)
    .reduce((totals, line) => ({ ...totals, [line.id]: (totals[line.id] || 0) + line.quantity }), {});
  const requestCountByItem = requests
    .filter((request) => !["Rejected", "Cancelled"].includes(request.statusKey))
    .flatMap((request) => request.lines.map((line) => line.id))
    .reduce((totals, id) => ({ ...totals, [id]: (totals[id] || 0) + 1 }), {});
  return {
    reservedByItem,
    requestCountByItem,
    totalQuantity: items.reduce((total, item) => total + item.totalQuantity, 0),
    reservedQuantity: Object.values(reservedByItem).reduce((total, quantity) => total + quantity, 0),
    availableQuantity: items.reduce((total, item) => total + item.quantity, 0),
  };
}

function InventoryAdminStockTable({ items, requests }) {
  const { reservedByItem, requestCountByItem } = getAdminInventorySummary(items, requests);
  return (
    <div className="table-scroll">
      <table className="admin-inventory-table">
        <thead><tr><th>القطعة</th><th>التصنيف</th><th>الكمية الكاملة</th><th>المحجوزة</th><th>المتاحة</th><th>حالة المخزون</th><th>الطلبات المرتبطة</th></tr></thead>
        <tbody>{items.map((item) => {
          const Icon = item.icon || Boxes;
          const reserved = reservedByItem[item.id] || 0;
          const status = item.quantity === 0 ? "غير متوفر" : reserved > 0 ? "متاح ومحجوز" : "متاح";
          return <tr key={item.id}>
            <td><span className="admin-item-cell">{item.image ? <img className="admin-item-image" src={item.image} alt="" loading="lazy" /> : <span className={`admin-item-icon tone-${item.tone}`}><Icon size={20} /></span>}<span><strong>{item.name}</strong><small className="admin-item-name-en" dir="ltr">{item.nameEn}</small><small dir="ltr">{item.id}</small></span></span></td>
            <td>{item.category}</td>
            <td><strong className="admin-quantity-total" dir="ltr">{item.totalQuantity.toLocaleString("ar-EG")}</strong></td>
            <td><span className={`admin-reserved-quantity ${reserved ? "" : "is-zero"}`} dir="ltr">{reserved.toLocaleString("ar-EG")}</span></td>
            <td><span className={`admin-available-quantity ${item.quantity ? "" : "is-empty"}`} dir="ltr">{item.quantity.toLocaleString("ar-EG")}</span></td>
            <td><span className={`admin-stock-status ${item.quantity === 0 ? "status-empty" : reserved ? "status-mixed" : "status-available"}`}><i />{status}</span></td>
            <td>{(requestCountByItem[item.id] || 0).toLocaleString("ar-EG")}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function InventoryAdminWarehouse({ items, requests }) {
  const [filter, setFilter] = useState("الكل");
  const [query, setQuery] = useState("");
  const summary = getAdminInventorySummary(items, requests);
  const filteredItems = items.filter((item) => {
    const reserved = summary.reservedByItem[item.id] || 0;
    const matchesStatus = filter === "الكل"
      || (filter === "متاح" && item.quantity > 0 && reserved === 0)
      || (filter === "محجوز" && reserved > 0)
      || (filter === "غير متوفر" && item.quantity === 0);
    return matchesStatus && `${item.name} ${item.nameEn} ${item.id} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const filters = ["الكل", "متاح", "محجوز", "غير متوفر"];

  return (
    <div className="page-content admin-warehouse">
      <section className="admin-welcome">
        <div>
          <span className="section-eyebrow">إدارة المستودع</span>
          <h2>كل قطعة <span>بصورتها الواضحة</span></h2>
          <p>راجع الكمية الكاملة والمحجوزة والمتاحة لكل صنف في مستودع النادي.</p>
        </div>
        <span className="admin-warehouse-total"><Boxes size={21} /><strong dir="ltr">{summary.totalQuantity.toLocaleString("ar-EG")}</strong><small>قطعة إجمالًا</small></span>
      </section>

      <section className="admin-stats-grid admin-warehouse-stats" aria-label="ملخص المستودع">
        <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-red"><Boxes size={20} /></span><span><small>إجمالي القطع</small><strong dir="ltr">{summary.totalQuantity.toLocaleString("ar-EG")}</strong><em>الكمية الكاملة في المستودع</em></span></article>
        <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-amber"><Package size={20} /></span><span><small>قطع محجوزة</small><strong dir="ltr">{summary.reservedQuantity.toLocaleString("ar-EG")}</strong><em>ضمن طلبات الفرق النشطة</em></span></article>
        <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-green"><CheckCircle2 size={20} /></span><span><small>قطع متاحة</small><strong dir="ltr">{summary.availableQuantity.toLocaleString("ar-EG")}</strong><em>متاحة للتجهيز</em></span></article>
        <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-blue"><LayoutDashboard size={20} /></span><span><small>أصناف المستودع</small><strong dir="ltr">{items.length.toLocaleString("ar-EG")}</strong><em>أنواع مختلفة من القطع</em></span></article>
      </section>

      <section className="panel admin-inventory-panel">
        <div className="admin-panel-heading">
          <div><span className="section-eyebrow">جرد المخزون</span><h3>القطع الموجودة في المستودع</h3><p>استخدم البحث أو الحالة للوصول إلى القطعة بسرعة.</p></div>
          <span className="admin-type-count"><Boxes size={17} /> {filteredItems.length.toLocaleString("ar-EG")} من {items.length.toLocaleString("ar-EG")} أصناف</span>
        </div>
        <div className="admin-warehouse-toolbar">
          <div className="admin-warehouse-filters" role="group" aria-label="تصفية حالة القطع">
            {filters.map((name) => <button key={name} type="button" className={`category-tab ${filter === name ? "active-tab" : ""}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}
          </div>
          <label className="admin-warehouse-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم القطعة أو رقمها" aria-label="ابحث في المستودع" /></label>
        </div>
        {filteredItems.length
          ? <InventoryAdminStockTable items={filteredItems} requests={requests} />
          : <div className="empty-state"><Search size={25} /><strong>لا توجد قطع مطابقة</strong><span>جرّب تغيير البحث أو حالة المخزون.</span><button onClick={() => { setQuery(""); setFilter("الكل"); }}>عرض كل القطع</button></div>}
        <div className="admin-inventory-note"><CircleHelp size={16} /> المحجوز هو ما خُصص للطلبات قيد المراجعة أو الموافقة، والمتاح هو الرصيد الجاهز للصرف.</div>
      </section>
    </div>
  );
}

function InventoryCatalog({ items, selectedItems, quantities, onAdd, onQuantityChange, query, onQueryChange, requestLock, onViewRequests }) {
  const [category, setCategory] = useState("الكل");
  const [availableOnly, setAvailableOnly] = useState(false);
  const categories = ["الكل", "لوحات تحكم", "حساسات", "محركات"];
  const filtered = items.filter((item) =>
    (category === "الكل" || item.category === category)
    && `${item.name} ${item.nameEn} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase())
    && (!availableOnly || item.quantity > 0),
  );
  const selected = items.filter((item) => selectedItems.includes(item.id));
  return (
    <div className="page-content">
      <div className="catalog-intro"><div><span className="section-eyebrow">اكتشف موارد النادي</span><h2>كل ما يحتاجه مشروعك، <span>هنا.</span></h2><p>تصفّح المكونات المتاحة وتحقق من الكمية لكل قطعة.</p></div><div className="catalog-total"><Boxes size={18} /><span><strong>{items.length.toLocaleString("ar-EG")}</strong> قطع في الكتالوج</span></div></div>
      {requestLock && <div className="request-lock-notice" role="status"><span><ShieldCheck size={18} /><span>{requestLock.statusKey === "Pending" ? "طلبك قيد المراجعة. يمكنك التقديم من جديد إذا رفضه المشرف." : "تمت الموافقة على طلب فريقك؛ لا يمكن إرسال طلب آخر."}</span></span><button type="button" onClick={onViewRequests}>متابعة الطلب <ArrowLeft size={15} /></button></div>}
      <div className="catalog-toolbar">
        <div className="category-tabs" role="group" aria-label="تصنيف القطع">
          {categories.map((name) => <button key={name} className={`category-tab ${category === name ? "active-tab" : ""}`} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}
        </div>
        <button type="button" className={`catalog-availability-toggle ${availableOnly ? "filter-active" : ""}`} aria-pressed={availableOnly} onClick={() => setAvailableOnly((current) => !current)}>
          <Filter size={15} /> {availableOnly ? "عرض كل القطع" : "المتاحة فقط"}
        </button>
      </div>
      <div className="catalog-result-line"><span>عرض <strong>{filtered.length.toLocaleString("ar-EG")}</strong> قطع</span><span><i className="stock-dot in-stock" /> متوفر <i className="stock-dot low-stock" /> كمية محدودة</span></div>
      <div className="catalog-shopping-layout">
        <div className="catalog-products">
          {filtered.length ? <div className="component-grid catalog-grid">{filtered.map((item) => <InventoryComponentCard key={item.id} item={item} onAdd={onAdd} added={selectedItems.includes(item.id)} quantity={quantities[item.id] || 1} onQuantityChange={onQuantityChange} requestLocked={Boolean(requestLock)} />)}</div> : <div className="empty-state"><Search size={27} /><strong>لم نعثر على قطع مطابقة</strong><span>غيّر كلمة البحث أو التصنيف المحدد.</span><button onClick={() => { onQueryChange(""); setCategory("الكل"); setAvailableOnly(false); }}>عرض كل القطع</button></div>}
        </div>
      </div>
      <div className="stock-disclaimer"><CircleHelp size={16} /> الكميات المتاحة وفق سجل مخزون النادي.</div>
    </div>
  );
}

function InventoryNewRequest({ items, selectedItems, quantities, draft, onDraftChange, onQuantity, onRemove, onNavigate, onSubmit, requestLock, expired }) {
  const [error, setError] = useState("");
  const chosen = items.filter((item) => selectedItems.includes(item.id));
  const total = chosen.reduce((sum, item) => sum + (quantities[item.id] || 1), 0);

  if (requestLock) {
    return (
      <div className="page-content">
        <div className="request-lock-panel">
          <span className="request-lock-icon"><LockKeyhole size={23} /></span>
          <h2>{requestLock.statusKey === "Pending" ? "طلبك قيد المراجعة" : "تمت الموافقة على طلب فريقك"}</h2>
          <p>{requestLock.statusKey === "Pending" ? "انتظر قرار المشرف قبل إرسال طلب آخر. إذا رُفض الطلب، يمكنك التقديم من جديد." : "يسمح لكل فريق بطلب واحد معتمد فقط، ولا يمكن إرسال طلب إضافي بعد الموافقة."}</p>
          <button type="button" className="button-primary" onClick={() => onNavigate("requests")}>عرض طلباتي <ArrowLeft size={16} /></button>
        </div>
      </div>
    );
  }

  function submit(event) {
    event.preventDefault();
    if (expired) { setError("Time's Up! انتهى وقت الهاكاثون ولا يمكن إرسال الطلب."); return; }
    if (!draft.project.trim()) { setError("أدخل اسم المشروع قبل الإرسال."); return; }
    const members = draft.members.split(/[\n,،]+/).map((member) => member.trim()).filter(Boolean);
    if (!members.length) { setError("اكتب اسم عضو واحد على الأقل في المشروع."); return; }
    if (!draft.description.trim()) { setError("اكتب ملخصًا عن المشروع قبل الإرسال."); return; }
    if (!chosen.length) { setError("أضف قطعة واحدة على الأقل من الكتالوج."); return; }
    if (!draft.confirmed) { setError("أكد اطلاعك على أن الطلب لا يمكن تعديله بعد الإرسال."); return; }
    setError("");
    onSubmit({ project: draft.project.trim(), members, description: draft.description.trim(), items: chosen, total });
  }

  return (
    <div className="page-content">
      <div className="request-intro"><div><span className="section-eyebrow">طلب تجهيز مشروعك</span><h2>فكرتك تستحق <span>أن تُبنى.</span></h2><p>اكتب تفاصيل مشروعك واختر القطع التي تحتاج إليها.</p></div><div className="steps-indicator"><span className="step-active"><i>١</i> تفاصيل المشروع</span><span className="step-connector" /><span><i>٢</i> مراجعة وإرسال</span></div></div>
      {error && <div className="form-alert error-alert request-error" role="alert"><CircleHelp size={17} />{error}</div>}
      <form className="request-layout" onSubmit={submit}>
        <div className="request-main">
          <section className="panel form-panel"><div className="panel-title"><span className="panel-step">٠١</span><div><h3>تفاصيل المشروع</h3><p>اكتب المعلومات التي يحتاجها مشرف النادي لمراجعة طلبك.</p></div><FileText size={20} /></div>
            <label className="field-label" htmlFor="request-project">اسم المشروع <span>*</span></label><input id="request-project" className="form-input" placeholder="مثال: روبوت استكشاف ذكي" value={draft.project} onChange={(event) => onDraftChange({ project: event.target.value })} required />
            <label className="field-label" htmlFor="request-members">أسماء أعضاء المشروع <span>*</span></label><textarea id="request-members" className="form-input form-textarea request-members-input" placeholder={"اكتب أسماء أعضاء الفريق، اسمًا في كل سطر\nمثال: أحمد محمد"} rows={3} value={draft.members} onChange={(event) => onDraftChange({ members: event.target.value })} required />
            <div className="field-hint"><Users size={14} /> يمكنك فصل الأسماء بأسطر أو بفواصل.</div>
            <label className="field-label" htmlFor="request-description">ملخص المشروع <span>*</span></label><textarea id="request-description" className="form-input form-textarea" placeholder="اشرح فكرة المشروع وطريقة عمله باختصار..." rows={4} value={draft.description} onChange={(event) => onDraftChange({ description: event.target.value })} required />
          </section>
          <section className="panel form-panel selected-panel"><div className="panel-title"><span className="panel-step">٠٢</span><div><h3>القطع المطلوبة <span className="title-bubble">{chosen.length.toLocaleString("ar-EG")}</span></h3><p>حدد القطع والكميات المناسبة لمشروعك.</p></div><Boxes size={20} /></div>
            {chosen.length ? <div className="selected-list">{chosen.map((item) => <div className="selected-item" key={item.id}>{item.image ? <img className="selected-item-image" src={item.image} alt="" loading="lazy" /> : <span className={`selected-thumb tone-${item.tone}`}><item.icon size={20} /></span>}<span className="selected-name"><strong>{item.name}</strong><small dir="ltr">{item.nameEn}</small><span dir="ltr">{item.id}</span></span><span className="selected-available">متاح <b dir="ltr">{item.quantity}</b></span><label className="quantity-select"><span className="sr-only">الكمية المطلوبة</span><select value={quantities[item.id] || 1} onChange={(event) => onQuantity(item.id, Number(event.target.value))}>{Array.from({ length: item.quantity }, (_, index) => <option value={index + 1} key={index + 1}>{String(index + 1).padStart(2, "0")}</option>)}</select><ChevronDown size={13} /></label><button type="button" className="remove-item" aria-label={`حذف ${item.name}`} onClick={() => onRemove(item.id)}><X size={16} /></button></div>)}</div> : <div className="empty-selection"><div><Boxes size={22} /></div><strong>لم تضف أي قطعة بعد</strong><span>تصفّح الكتالوج واختر ما يحتاجه مشروعك.</span><button type="button" onClick={() => onNavigate("catalog")}>تصفّح القطع <ArrowLeft size={14} /></button></div>}
            <button type="button" className="add-more-button" onClick={() => onNavigate("catalog")}><Plus size={16} /> أضف قطعًا أخرى من الكتالوج</button>
          </section>
        </div>
        <aside className="request-aside"><section className="panel summary-panel"><div className="summary-title"><span>ملخص الطلب</span><span className="draft-label"><i /> مسودة</span></div><div className="summary-project"><span>المشروع</span><strong>{draft.project || "سيظهر اسم مشروعك هنا"}</strong></div><div className="summary-line"><span>أعضاء المشروع</span><strong>{draft.members.split(/[\n,،]+/).filter((member) => member.trim()).length.toLocaleString("ar-EG")}</strong></div><div className="summary-line"><span>أنواع القطع</span><strong>{chosen.length.toLocaleString("ar-EG")}</strong></div><div className="summary-line"><span>إجمالي الكمية</span><strong>{total.toLocaleString("ar-EG")} قطع</strong></div><div className="summary-line"><span>الحالة الأولية</span><InventoryStatus statusKey="Pending">قيد المراجعة</InventoryStatus></div><div className="summary-divider" /><label className="confirm-warning"><input type="checkbox" checked={draft.confirmed} onChange={(event) => onDraftChange({ confirmed: event.target.checked })} /><span className="confirm-check"><Check size={13} /></span><span>أؤكد أنني راجعت الطلب، وأفهم أنه <strong>لا يمكن تعديله بعد الإرسال.</strong></span></label><button className="button-primary submit-request-button" type="submit" disabled={expired}><span>{expired ? "Time's Up!" : "إرسال الطلب للمراجعة"}</span>{!expired && <ArrowLeft size={17} />}</button><div className="secure-note"><ShieldCheck size={14} /> {expired ? "انتهى وقت إرسال الطلبات." : "سيُرسل الطلب للمشرف لمراجعته."}</div></section></aside>
      </form>
    </div>
  );
}

function InventoryRequests({ requests, account, onCancel, onOpen, onApprove, onReject, onApproveReturn }) {
  const [filter, setFilter] = useState("الكل");
  const [query, setQuery] = useState("");
  const filters = ["الكل", "قيد المراجعة", "تمت الموافقة", "تم التسليم", "طلب إعادة القطع", "تمت إعادة القطع", "مرفوض", "تم الإلغاء"];
  const visible = requests.filter((request) => {
    const displayStatus = request.returnStatus === "Pending" ? "طلب إعادة القطع" : request.status;
    return (filter === "الكل" || displayStatus === filter)
      && `${request.id} ${request.project} ${request.teamEmail || ""} ${(request.members || []).join(" ")} ${request.description || ""}`.toLowerCase().includes(query.toLowerCase());
  });
  return (
    <div className="page-content">
      <div className={`requests-intro ${account.role === "admin" ? "admin-requests-intro" : ""}`}><div><span className="section-eyebrow">{account.role === "admin" ? "مركز متابعة الفرق" : "متابعة المشاريع"}</span><h2>{account.role === "admin" ? <>إدارة <span>طلبات الفرق</span></> : <>طلباتك، <span>خطوة بخطوة.</span></>}</h2><p>{account.role === "admin" ? "راجع الطلبات الواردة وتابع حالتها وتفاصيل القطع المطلوبة." : "تابع حالة الطلبات والتحديثات الخاصة بفريقك."}</p></div><div className="request-count-card"><span className="count-icon"><FileText size={19} /></span><span><strong>{requests.length.toLocaleString("ar-EG")}</strong><small>إجمالي الطلبات</small></span></div></div>
      <div className="requests-filter-bar"><div className="category-tabs" role="group" aria-label="تصفية الطلبات">{filters.map((name) => <button key={name} className={`category-tab ${filter === name ? "active-tab" : ""}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div><label className="catalog-search"><Search size={16} /><input aria-label="ابحث برقم الطلب أو المشروع" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الطلب أو المشروع..." /></label></div>
      <section className="panel requests-panel"><div className="requests-panel-heading"><div><h3>{account.role === "admin" ? "طلبات الفرق" : "سجل الطلبات"}</h3><p>{account.role === "admin" ? "راجع طلبات الفرق وأكد استلام القطع المعادة إلى المستودع." : "تابع حالة الطلبات والتحديثات الخاصة بفريقك."}</p></div><button className="export-button" onClick={() => window.print()}><ArrowUpLeft size={15} /> طباعة</button></div>{visible.length ? <InventoryRequestTable requests={visible} account={account} onCancel={onCancel} onOpen={onOpen} onApprove={onApprove} onReject={onReject} onApproveReturn={onApproveReturn} /> : <div className="empty-state"><FileText size={25} /><strong>لا توجد طلبات مطابقة</strong><span>غيّر حالة التصفية أو عبارة البحث.</span><button onClick={() => { setQuery(""); setFilter("الكل"); }}>إعادة ضبط التصفية</button></div>}</section>
      <div className="requests-footnote"><ShieldCheck size={15} /> {account.role === "admin" ? "افتح تفاصيل الطلب لمراجعة ملخص المشروع وأسماء الأعضاء قبل اتخاذ القرار." : "يمكن إلغاء الطلب فقط قبل أن يبدأ المشرف بمراجعته."}</div>
    </div>
  );
}

function InventoryCustody({ requests, items, account, onRequestReturn }) {
  const approvedRequests = requests.filter((request) =>
    request.teamEmail?.toLowerCase() === account.email.toLowerCase()
    && ["Approved", "Delivered"].includes(request.statusKey),
  );
  const returnRequestPending = approvedRequests.some((request) => request.returnStatus === "Pending");
  const rows = approvedRequests.flatMap((request) => request.lines.map((line) => {
    const item = items.find((inventoryItem) => inventoryItem.id === line.id);
    return {
      id: line.id,
      name: item?.name || line.id,
      tone: item?.tone || "blue",
      icon: item?.icon || Boxes,
      quantity: line.quantity,
      project: request.project,
      date: request.date,
      requestId: request.id,
      statusKey: request.statusKey,
    };
  }));
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);
  const itemTypeCount = new Set(rows.map((row) => row.id)).size;
  const latestApprovalDate = approvedRequests[0]?.date;

  return (
    <div className="page-content custody-page">
      <section className="custody-hero">
        <div className="custody-hero-copy">
          <span className="section-eyebrow">الطلبات المعتمدة من المشرف</span>
          <h2>عهدة فريقك، <span>مرتبطة بموافقاتك.</span></h2>
          <p>تظهر هنا القطع والكميات الواردة في طلبات فريقك التي وافق عليها المشرف.</p>
        </div>
        <div className="custody-total">
          <span><Package size={23} /></span>
          <strong>{totalQuantity.toLocaleString("ar-EG")}</strong>
          <small>قطع معتمدة</small>
        </div>
        <div className="custody-watermark"><Package size={125} strokeWidth={.75} /></div>
      </section>
      <section className="custody-summary" aria-label="ملخص العهدة">
        <div><span className="custody-summary-icon custody-summary-red"><Boxes size={18} /></span><span><small>أنواع القطع المعتمدة</small><strong>{itemTypeCount.toLocaleString("ar-EG")} أصناف</strong></span></div>
        <div><span className="custody-summary-icon custody-summary-green"><CheckCircle2 size={18} /></span><span><small>الطلبات المعتمدة</small><strong>{approvedRequests.length.toLocaleString("ar-EG")} طلب</strong></span></div>
        <div><span className="custody-summary-icon custody-summary-blue"><CalendarDays size={18} /></span><span><small>تاريخ آخر طلب معتمد</small><strong>{latestApprovalDate || "لا توجد موافقات بعد"}</strong></span></div>
      </section>
      <section className="panel custody-panel">
        <div className="requests-panel-heading">
          <div><span className="section-eyebrow">سجل الموافقات</span><h3>القطع التي وافق عليها المشرف</h3><p>تفاصيل القطع والكميات والمشروع لكل طلب معتمد.</p></div>
          <div className="custody-panel-actions">
            <InventoryStatus statusKey={returnRequestPending ? "ReturnPending" : approvedRequests.length ? "Approved" : "Pending"}>
              {returnRequestPending ? "بانتظار تأكيد الإعادة" : `${totalQuantity.toLocaleString("ar-EG")} قطع معتمدة`}
            </InventoryStatus>
            {approvedRequests.length > 0 && (
              <button
                type="button"
                className="return-items-button"
                disabled={returnRequestPending}
                onClick={() => onRequestReturn(approvedRequests[0].id)}
              >
                <Package size={15} />
                {returnRequestPending ? "بانتظار تأكيد المشرف" : "إرجاع القطع"}
              </button>
            )}
          </div>
        </div>
        <div className="custody-list">
          {rows.length ? rows.map((row) => (
            <article className="custody-item" key={`${row.requestId}-${row.id}`}>
              <span className={`custody-item-icon tone-${row.tone}`}><row.icon size={20} /></span>
              <span className="custody-item-name"><strong>{row.name}</strong><span dir="ltr">{row.id}</span></span>
              <span className="custody-item-meta"><small>المشروع</small><strong>{row.project}</strong></span>
              <span className="custody-item-meta"><small>تاريخ الطلب</small><strong>{row.date}</strong></span>
              <span className="custody-qty"><small>الكمية</small><strong dir="ltr">× {row.quantity}</strong></span>
              <span className="condition-label"><i /> {row.statusKey === "Delivered" ? "تم التسليم" : "موافقة المشرف"}</span>
            </article>
          )) : (
            <div className="custody-empty-state">
              <span><Package size={24} /></span>
              <strong>لا توجد قطع معتمدة حتى الآن</strong>
              <p>ستظهر هنا تفاصيل القطع فور موافقة المشرف على طلب فريقك.</p>
            </div>
          )}
        </div>
        <div className="custody-panel-foot"><CircleHelp size={15} /><span>تُحدّث العهدة تلقائيًا عند موافقة المشرف على طلب جديد.</span></div>
      </section>
      <div className="custody-notice"><ShieldCheck size={17} /><div><strong>سياسة طلبات الفريق</strong><span>يحق للفريق إرسال طلب جديد بعد رفض الطلب السابق. أما إذا تمت الموافقة عليه، فلا يمكن إرسال طلب آخر للفريق.</span></div></div>
    </div>
  );
}

function InventoryRequestModal({ request, items, canReview, onClose, onApprove, onReject }) {
  if (!request) return null;
  const isPendingReview = canReview && request.statusKey === "Pending";
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section className="request-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="inventory-request-title">
        <button className="modal-close" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        <span className="modal-icon"><FileText size={22} /></span>
        <span className="section-eyebrow">تفاصيل الطلب</span>
        <h2 id="inventory-request-title">{request.project}</h2>
        <span className="modal-request-id" dir="ltr">{request.id}</span>
        {canReview && <div className="request-modal-team"><span>الفريق</span><strong dir="ltr">{request.teamEmail || "غير محدد"}</strong></div>}
        <div className="modal-details">
          <div><span>تاريخ التقديم</span><strong>{request.date}</strong></div>
          <div><span>عدد أنواع القطع</span><strong>{request.lines.length} أنواع</strong></div>
          <div><span>الحالة</span><InventoryStatus statusKey={request.returnStatus === "Pending" ? "ReturnPending" : request.statusKey}>{request.returnStatus === "Pending" ? "طلب إعادة القطع" : request.status}</InventoryStatus></div>
        </div>
        {Array.isArray(request.members) && request.members.length > 0 && <section className="request-modal-members"><h3><Users size={16} /> أسماء أعضاء المشروع</h3><ul>{request.members.map((member, index) => <li key={`${member}-${index}`}>{member}</li>)}</ul></section>}
        {request.description && <section className="request-modal-description"><h3>ملخص المشروع</h3><p>{request.description}</p></section>}
        <div className="request-modal-components">
          <h3>القطع المطلوبة</h3>
          <div className="selected-list">{request.lines.map((line) => { const component = items.find((item) => item.id === line.id); return <div className="selected-item" key={line.id}><span className="selected-name"><strong>{component?.name || line.id}</strong><span dir="ltr">{line.id}</span></span><span className="selected-available">الكمية: <b dir="ltr">{line.quantity}</b></span></div>; })}</div>
        </div>
        {isPendingReview ? <div className="request-review-actions"><button className="button-danger" onClick={() => onReject(request.id)}>رفض الطلب</button><button className="button-primary" onClick={() => onApprove(request.id)}><Check size={16} /> الموافقة على الطلب</button></div> : <button className="button-outline modal-done" onClick={onClose}>إغلاق التفاصيل</button>}
      </section>
    </div>
  );
}

function InventoryCancelModal({ onConfirm, onClose }) {
  return <div className="modal-backdrop" onClick={onClose} role="presentation"><section className="confirm-modal" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="cancel-request-title"><span className="confirm-modal-icon"><CircleHelp size={23} /></span><h2 id="cancel-request-title">إلغاء هذا الطلب؟</h2><p>يمكن إلغاء الطلب قبل مراجعته فقط. لا يمكن التراجع عن هذا الإجراء.</p><div><button className="button-outline" onClick={onClose}>العودة</button><button className="button-danger" onClick={onConfirm}>نعم، ألغِ الطلب</button></div></section></div>;
}

function InventoryWorkspace({ account, endAt, onLogout, theme, onToggleTheme, items, setItems, requests, setRequests }) {
  const [activePage, setActivePage] = useState(account.role === "admin" ? "overview" : "catalog");
  const [selectedItems, setSelectedItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [requestDraft, setRequestDraft] = useState({ project: "", members: "", description: "", confirmed: false });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [toast, setToast] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const remaining = useHackathonRemaining(endAt);
  const hackathonExpired = remaining === 0;
  const teamRequests = requests.filter((request) => request.teamEmail?.toLowerCase() === account.email.toLowerCase());
  const approvedRequest = teamRequests.find((request) => ["Approved", "Delivered", "Returned"].includes(request.statusKey));
  const pendingRequest = teamRequests.find((request) => request.statusKey === "Pending");
  const requestLock = account.role === "admin" ? null : approvedRequest || pendingRequest || null;
  const pageInfo = {
    overview: ["لوحة التحكم", "ملخص المستودع والطلبات الواردة"],
    catalog: ["كتالوج القطع", "تصفّح مكونات النادي المتاحة"],
    "new-request": ["طلب جديد", "أرسل طلبًا واحدًا للفريق وانتظر قرار المشرف"],
    requests: [account.role === "admin" ? "طلبات الفرق" : "طلباتي", account.role === "admin" ? "مراجعة طلبات الفرق وحالاتها" : "تابع حالة الطلبات وتحديثاتها"],
    custody: ["العهدة", "القطع المعتمدة من المشرف لفريقك"],
  };

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function addItem(item, quantity = 1) {
    if (requestLock) {
      notify("لا يمكن إضافة قطع لطلب جديد قبل إغلاق الطلب الحالي");
      return;
    }
    if (!item.quantity || quantity < 1 || quantity > item.quantity) return;
    setSelectedItems((current) => current.includes(item.id) ? current : [...current, item.id]);
    setQuantities((current) => ({ ...current, [item.id]: quantity }));
    notify(`أُضيف ${quantity.toLocaleString("ar-EG")} من ${item.name} إلى السلة`);
  }

  function submitRequest(details) {
    if (Date.now() >= endAt) {
      notify("Time's Up! انتهى وقت الهاكاثون ولا يمكن إرسال الطلب.");
      return;
    }
    if (requestLock) {
      setActivePage("requests");
      notify(requestLock.statusKey === "Pending"
        ? "انتظر قرار المشرف. يمكنك إعادة الطلب إذا تم رفضه"
        : "لدى الفريق طلب معتمد بالفعل، ولا يمكن إرسال طلب إضافي");
      return;
    }
    const invalidLine = details.items.find((item) => {
      const quantity = Number(quantities[item.id]) || 1;
      return quantity < 1 || quantity > item.quantity;
    });
    if (invalidLine) {
      notify(`الكمية المطلوبة من ${invalidLine.name} تتجاوز المتاح في المخزون`);
      return;
    }
    const newRequest = {
      id: `REQ-${new Date().getFullYear()}-${String(requests.length + 25).padStart(3, "0")}`,
      project: details.project,
      teamEmail: account.email,
      date: new Intl.DateTimeFormat("ar-EG", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()),
      status: "قيد المراجعة",
      statusKey: "Pending",
      lines: details.items.map((item) => ({ id: item.id, quantity: quantities[item.id] || 1 })),
      members: details.members,
      description: details.description,
    };
    setRequests((current) => [newRequest, ...current]);
    setItems((current) => current.map((item) => {
      const line = newRequest.lines.find((requested) => requested.id === item.id);
      return line ? { ...item, quantity: item.quantity - line.quantity } : item;
    }));
    setSelectedItems([]);
    setQuantities({});
    setRequestDraft({ project: "", members: "", description: "", confirmed: false });
    setActivePage("requests");
    notify("تم إرسال طلبك للمراجعة");
  }

  function reviewRequest(id, decision) {
    if (account.role !== "admin") {
      notify("هذا الإجراء متاح للمشرف فقط");
      return;
    }
    const request = requests.find((item) => item.id === id);
    if (!request || request.statusKey !== "Pending") {
      notify("لم يعد هذا الطلب بانتظار المراجعة");
      return;
    }
    if (decision === "approve") {
      const alreadyApproved = requests.some((item) =>
        item.id !== request.id
        && Boolean(request.teamEmail)
        && item.teamEmail?.toLowerCase() === request.teamEmail?.toLowerCase()
        && ["Approved", "Delivered", "Returned"].includes(item.statusKey),
      );
      if (alreadyApproved) {
        notify("لدى هذا الفريق طلب معتمد بالفعل. ارفض الطلب الحالي لإبقائه ضمن حد طلب واحد");
        return;
      }
      setRequests((current) => current.map((item) => item.id === id && item.statusKey === "Pending" ? { ...item, status: "تمت الموافقة", statusKey: "Approved" } : item));
      notify("تمت الموافقة على الطلب");
    } else {
      setRequests((current) => current.map((item) => item.id === id && item.statusKey === "Pending" ? { ...item, status: "مرفوض", statusKey: "Rejected" } : item));
      setItems((current) => current.map((item) => {
        const line = request.lines.find((requested) => requested.id === item.id);
        return line ? { ...item, quantity: item.quantity + line.quantity } : item;
      }));
      notify("تم رفض الطلب وإعادة الكميات إلى المخزون");
    }
    setViewingRequest(null);
  }

  function requestItemReturn(id) {
    if (account.role === "admin") {
      notify("يجب أن يطلب الفريق إعادة القطع من صفحة العهدة");
      return;
    }
    const request = requests.find((item) => item.id === id);
    if (!request || request.teamEmail?.toLowerCase() !== account.email.toLowerCase() || !["Approved", "Delivered"].includes(request.statusKey)) {
      notify("لا يمكن طلب إعادة قطع لهذا الطلب");
      return;
    }
    if (request.returnStatus === "Pending") {
      notify("طلب إعادة القطع بانتظار تأكيد المشرف");
      return;
    }
    if (request.returnStatus === "Approved" || request.statusKey === "Returned") {
      notify("تم تأكيد إعادة قطع هذا الطلب مسبقًا");
      return;
    }
    setRequests((current) => current.map((item) =>
      item.id === id && ["Approved", "Delivered"].includes(item.statusKey)
        ? { ...item, returnStatus: "Pending" }
        : item,
    ));
    notify("تم إرسال طلب إعادة القطع إلى المشرف");
  }

  function approveItemReturn(id) {
    if (account.role !== "admin") {
      notify("تأكيد استلام القطع متاح للمشرف فقط");
      return;
    }
    const request = requests.find((item) => item.id === id);
    if (!request || request.returnStatus !== "Pending" || !["Approved", "Delivered"].includes(request.statusKey)) {
      notify("لم يعد هناك طلب إعادة بانتظار التأكيد");
      return;
    }
    setItems((current) => current.map((item) => {
      const returnedLine = request.lines.find((line) => line.id === item.id);
      return returnedLine ? { ...item, quantity: item.quantity + returnedLine.quantity } : item;
    }));
    setRequests((current) => current.map((item) =>
      item.id === id && item.returnStatus === "Pending"
        ? { ...item, returnStatus: "Approved", status: "تمت إعادة القطع", statusKey: "Returned" }
        : item,
    ));
    notify("تم تأكيد الاستلام وإعادة القطع إلى المستودع");
  }

  function cancelRequest() {
    const request = requests.find((item) => item.id === cancelId);
    if (account.role !== "admin" && request?.statusKey === "Pending") {
      setRequests((current) => current.map((item) => item.id === cancelId && item.statusKey === "Pending" ? { ...item, status: "تم الإلغاء", statusKey: "Cancelled" } : item));
      setItems((current) => current.map((item) => {
        const line = request.lines.find((requested) => requested.id === item.id);
        return line ? { ...item, quantity: item.quantity + line.quantity } : item;
      }));
      notify("تم إلغاء الطلب وإعادة الكميات إلى المخزون");
    }
    setCancelId(null);
  }

  const [title, subtitle] = pageInfo[activePage];
  function searchCatalog(query) {
    setCatalogQuery(query);
    setActivePage("catalog");
  }

  return (
    <div className={`app-shell ${account.role === "admin" ? "app-shell-admin" : ""}`} dir="rtl">
      <InventorySidebar account={account} active={activePage} onNavigate={setActivePage} onLogout={onLogout} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} requestLock={requestLock} />
      <main className="main-column"><InventoryTopbar
        title={title}
        subtitle={subtitle}
        account={account}
        notifications={requests.filter((request) => account.role === "admin"
          ? request.statusKey === "Pending" || request.returnStatus === "Pending"
          : request.teamEmail?.toLowerCase() === account.email.toLowerCase()
            && (request.statusKey === "Pending" || request.returnStatus === "Pending"))}
        cartCount={selectedItems.reduce((total, id) => total + (Number(quantities[id]) || 1), 0)}
        cartOpen={cartOpen}
        onMenu={() => setMobileNavOpen(true)}
        onSearch={searchCatalog}
        onOpenRequests={() => setActivePage("requests")}
        onCartToggle={() => setCartOpen((open) => !open)}
        theme={theme}
        onToggleTheme={onToggleTheme}
        remaining={remaining}
      />
        {activePage === "overview" && account.role === "admin" && <InventoryAdminWarehouse items={items} requests={requests} />}
        {activePage === "catalog" && <InventoryCatalog items={items} selectedItems={selectedItems} quantities={quantities} onAdd={addItem} onQuantityChange={(id, value) => setQuantities((current) => ({ ...current, [id]: value }))} query={catalogQuery} onQueryChange={setCatalogQuery} requestLock={requestLock} onViewRequests={() => setActivePage("requests")} />}
        {activePage === "new-request" && <InventoryNewRequest items={items} selectedItems={selectedItems} quantities={quantities} draft={requestDraft} onDraftChange={(changes) => setRequestDraft((current) => ({ ...current, ...changes }))} onQuantity={(id, value) => setQuantities((current) => ({ ...current, [id]: value }))} onRemove={(id) => setSelectedItems((current) => current.filter((itemId) => itemId !== id))} onNavigate={setActivePage} onSubmit={submitRequest} requestLock={requestLock} expired={hackathonExpired} />}
        {activePage === "requests" && <InventoryRequests requests={requests} account={account} onCancel={setCancelId} onOpen={setViewingRequest} onApprove={(id) => reviewRequest(id, "approve")} onReject={(id) => reviewRequest(id, "reject")} onApproveReturn={approveItemReturn} />}
        {activePage === "custody" && <InventoryCustody requests={requests} items={items} account={account} onRequestReturn={requestItemReturn} />}
      </main>
      <InventoryCartSidebar
        open={cartOpen}
        items={items}
        selectedItems={selectedItems}
        quantities={quantities}
        onClose={() => setCartOpen(false)}
        onRemove={(id) => setSelectedItems((current) => current.filter((itemId) => itemId !== id))}
        onContinue={() => { setCartOpen(false); setActivePage(requestLock ? "requests" : "new-request"); }}
      />
      {toast && <div className="toast-message" role="status"><CheckCircle2 size={17} />{toast}</div>}
      {viewingRequest && <InventoryRequestModal request={requests.find((request) => request.id === viewingRequest.id) || viewingRequest} items={items} canReview={account.role === "admin"} onClose={() => setViewingRequest(null)} onApprove={(id) => reviewRequest(id, "approve")} onReject={(id) => reviewRequest(id, "reject")} />}
      {cancelId && <InventoryCancelModal onConfirm={cancelRequest} onClose={() => setCancelId(null)} />}
    </div>
  );
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [hackathonEndAt, setHackathonEndAt] = useState(null);
  const [savedLogin, setSavedLogin] = useState(null);
  const [inventoryItems, setInventoryItems] = useState(inventorySeed);
  const [requests, setRequests] = useState(requestSeed);
  const [theme, setTheme] = useState(() => localStorage.getItem("hmk-theme") === "light" ? "light" : "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("hmk-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#17191d" : "#f7f7f8");
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  if (account) {
    return <InventoryWorkspace account={account} endAt={hackathonEndAt} onLogout={() => setAccount(null)} theme={theme} onToggleTheme={toggleTheme} items={inventoryItems} setItems={setInventoryItems} requests={requests} setRequests={setRequests} />;
  }

  return (
    <main className="auth-page" dir="rtl">
      <StoryPanel />
      <LoginForm
        theme={theme}
        onToggleTheme={toggleTheme}
        savedLogin={savedLogin}
        onLogin={(nextAccount) => {
          setSavedLogin(nextAccount.remember ? { email: nextAccount.email } : null);
          setHackathonEndAt(getHackathonEndAt(nextAccount.email));
          setAccount(nextAccount);
        }}
      />
    </main>
  );
}
