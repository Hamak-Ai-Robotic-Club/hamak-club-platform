import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, CheckCircle2, CircleAlert, Hourglass, Moon, Sun, X } from "lucide-react";
import { Api } from "../api/client.js";
import { requestStatusLabels, returnStatusLabels } from "../lib/format.js";

/* ---------- Theme ---------- */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("hmk-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("hmk-theme", theme);
    } catch {
      /* storage unavailable */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#14171b" : "#f7f7f8");
  }, [theme]);
  const toggle = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}

export function ThemeToggle({ theme, onToggle, compact = false }) {
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

/* ---------- Logos (red in light mode, white in dark mode) ---------- */
export function ClubLogo({ theme, onDark = false, className = "" }) {
  const white = onDark || theme === "dark";
  return (
    <img
      className={`hmk-club-logo ${className}`}
      src={white ? "/brand/hmk-logo-white.webp" : "/brand/hmk-logo-red.webp"}
      alt="شعار نادي الهمك للذكاء الصنعي والروبوتيك"
      width="640"
      height="437"
    />
  );
}

export function Brand({ theme, onDark = false, subtitle = "للذكاء الصنعي والروبوتيك" }) {
  return (
    <div className={`hmk-brand ${onDark ? "hmk-brand-on-dark" : ""}`}>
      <ClubLogo theme={theme} onDark={onDark} />
      <span className="hmk-brand-copy">
        <strong>نادي الهمك</strong>
        <small>{subtitle}</small>
      </span>
    </div>
  );
}

export function HackathonLogo({ theme, onDark = false, className = "" }) {
  const white = onDark || theme === "dark";
  return (
    <img
      className={`hackathon-logo ${className}`}
      src={white ? "/brand/hackathon-logo-white.webp" : "/brand/hackathon-logo-red.webp"}
      alt="شعار هاكاثون الهمك HAMAK HACATHON"
      width="900"
      height="361"
    />
  );
}

/* Pixel "boot screen" hero: the hackathon logo assembles from pixels with
   scanlines, a glitch sweep and a pixel loading bar. */
export function HackathonHero({ theme, endAt }) {
  const remaining = useRemaining(endAt);
  return (
    <div className="hackathon-hero" aria-label="هاكاثون الهمك">
      <div className="hero-pixel-field" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} style={{ "--i": index }} />
        ))}
      </div>
      <div className="hero-logo-stage">
        <HackathonLogo theme={theme} onDark className="hero-logo hero-logo-main" />
        <HackathonLogo theme="light" className="hero-logo hero-logo-ghost" />
        <span className="hero-scan" aria-hidden="true" />
      </div>
      <div className="hero-boot" aria-hidden="true">
        <span className="hero-boot-label">LOADING INNOVATION</span>
        <span className="hero-boot-bar"><i /></span>
      </div>
      {endAt ? <PixelCountdown remaining={remaining} /> : null}
    </div>
  );
}

/* ---------- Countdown ---------- */
export function useRemaining(endAt) {
  const [remaining, setRemaining] = useState(() => (endAt ? Math.max(0, endAt - Date.now()) : null));
  useEffect(() => {
    if (!endAt) {
      setRemaining(null);
      return undefined;
    }
    const update = () => setRemaining(Math.max(0, endAt - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);
  return remaining;
}

export function useEventConfig() {
  const [endAt, setEndAt] = useState(null);
  useEffect(() => {
    Api.config()
      .then((data) => {
        const timestamp = data?.eventEndsAt ? Date.parse(data.eventEndsAt) : NaN;
        setEndAt(Number.isFinite(timestamp) ? timestamp : null);
      })
      .catch(() => setEndAt(null));
  }, []);
  return endAt;
}

function splitTime(remaining) {
  const totalSeconds = Math.ceil(remaining / 1000);
  return [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60].map((v) =>
    String(v).padStart(2, "0"),
  );
}

export function HackathonCountdown({ remaining }) {
  if (remaining === null || remaining === undefined) return null;
  const expired = remaining === 0;
  const [hours, minutes, seconds] = splitTime(remaining);
  return (
    <div className={`hackathon-countdown ${expired ? "countdown-finished" : ""}`} role="timer" aria-label={expired ? "انتهى الوقت" : `${hours}:${minutes}:${seconds}`}>
      {expired ? (
        <div className="countdown-expired-text" role="status">Time&apos;s Up!</div>
      ) : (
        <div className="countdown-display" dir="ltr">
          <Hourglass className="countdown-hourglass" size={22} strokeWidth={2.2} aria-hidden="true" />
          <time className="countdown-time">
            <span>{hours}</span><i>:</i><span>{minutes}</span><i>:</i>
            <span key={seconds} className="countdown-second">{seconds}</span>
          </time>
        </div>
      )}
    </div>
  );
}

function PixelCountdown({ remaining }) {
  if (remaining === null) return null;
  if (remaining === 0) return <div className="pixel-countdown pixel-countdown-done">TIME&apos;S UP!</div>;
  const [hours, minutes, seconds] = splitTime(remaining);
  return (
    <div className="pixel-countdown" dir="ltr" role="timer" aria-label={`${hours}:${minutes}:${seconds}`}>
      <Hourglass size={20} aria-hidden="true" />
      <span>{hours}</span><b>:</b><span>{minutes}</span><b>:</b><span>{seconds}</span>
    </div>
  );
}

/* ---------- Status badges ---------- */
const statusClasses = {
  Pending: "status-pending",
  Approved: "status-approved",
  "Partially Delivered": "status-partial",
  Delivered: "status-delivered",
  Rejected: "status-rejected",
  Cancelled: "status-cancelled",
};
const returnClasses = {
  "Not Returned": "status-return-pending",
  "Partially Returned": "status-partial",
  Returned: "status-returned",
};

export function RequestStatus({ status }) {
  return <span className={`status-badge ${statusClasses[status] || ""}`}>{requestStatusLabels[status] || status}</span>;
}

export function ReturnStatus({ status }) {
  if (!status) return <span className="muted-dash">—</span>;
  return <span className={`status-badge ${returnClasses[status] || ""}`}>{returnStatusLabels[status] || status}</span>;
}

/* ---------- Component picture ---------- */
export function ComponentThumb({ src, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`thumb-fallback ${className}`} aria-hidden={!alt}>
        <Boxes size={20} />
      </span>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

/* ---------- Modal ---------- */
export function Modal({ title, eyebrow, onClose, children, wide = false, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        ref={ref}
        tabIndex={-1}
        className={`app-modal ${wide ? "app-modal-wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="app-modal-header">
          <div>
            {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </header>
        <div className="app-modal-body">{children}</div>
        {footer && <footer className="app-modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "تأكيد", danger = false, busy = false, onConfirm, onClose, children }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button-outline" onClick={onClose} disabled={busy}>رجوع</button>
          <button type="button" className={danger ? "button-danger" : "button-primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "جارٍ التنفيذ..." : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="modal-message">{message}</p>}
      {children}
    </Modal>
  );
}

/* ---------- Toasts ---------- */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, tone = "success") => {
    window.clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  const element = toast ? (
    <div key={toast.id} className={`toast-message toast-${toast.tone}`} role="status">
      {toast.tone === "error" ? <CircleAlert size={17} /> : <CheckCircle2 size={17} />}
      {toast.message}
    </div>
  ) : null;
  return { show, element };
}

export function LoadingBlock({ label = "جارٍ التحميل..." }) {
  return (
    <div className="loading-block" role="status">
      <span className="pixel-loader" aria-hidden="true"><i /><i /><i /></span>
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="empty-state error-state" role="alert">
      <CircleAlert size={26} />
      <strong>تعذّر تحميل البيانات</strong>
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry}>إعادة المحاولة</button>}
    </div>
  );
}

/* Loads data with loading / error state. */
export function useLoader(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: "" });
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load, setData: (data) => setState((current) => ({ ...current, data })) };
}
