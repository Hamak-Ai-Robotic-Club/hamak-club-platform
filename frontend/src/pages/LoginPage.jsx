import { useState } from "react";
import { ArrowLeft, CircleHelp, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Sparkles, User, X } from "lucide-react";
import { Api } from "../api/client.js";
import { Brand, ClubLogo, HackathonHero, HackathonLogo, ThemeToggle } from "../components/ui.jsx";

function StoryPanel({ portal, theme, endAt }) {
  return (
    <section className={`auth-story auth-story-${portal}`}>
      <div className="auth-story-mesh" />
      <span className="auth-story-glow" />
      <header className="auth-story-header">
        <Brand theme={theme} onDark />
        <span className="auth-hackathon-tag" dir="ltr">{portal === "admin" ? <>ADMIN <i>CONSOLE</i></> : <>HMK <i>HACKATHON</i></>}</span>
      </header>

      <div className="auth-story-content story-stack">
        {portal === "team" ? (
          <>
            <HackathonHero theme={theme} endAt={endAt} />
            <div className="auth-story-copy">
              <span className="auth-eyebrow"><Sparkles size={14} /> بوابة الفرق المشاركة</span>
              <h1>من فكرة<br />إلى إنجاز</h1>
              <p>سجّل فكرة مشروعك، اختر القطع من مخزون النادي، وتابع طلبك وعهدتك خطوة بخطوة.</p>
            </div>
          </>
        ) : (
          <>
            <div className="admin-story-logos">
              <ClubLogo theme={theme} onDark className="admin-story-club" />
              <span className="admin-story-x" aria-hidden="true">×</span>
              <HackathonLogo theme={theme} onDark className="admin-story-hack" />
            </div>
            <div className="auth-story-copy">
              <span className="auth-eyebrow"><ShieldCheck size={14} /> لوحة الإدارة واللوجستيات</span>
              <h1>تحكّم كامل<br />بالمخزون</h1>
              <p>راقب حالة النظام، راجع طلبات الفرق، سجّل التسليم والإرجاع، وأدر القطع والكميات والحسابات.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function LoginPage({ portal, theme, onToggleTheme, endAt, onLogin, signedInElsewhere, onLogout }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (username.trim().length < 3 || !password) {
      setError("أدخل اسم المستخدم وكلمة المرور للمتابعة.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await Api.login(username.trim(), password);
      if (portal === "admin" && user.role !== "admin") {
        await Api.logout().catch(() => {});
        setError("هذه البوابة مخصصة لحسابات الإدارة فقط. استخدم بوابة الفرق.");
        return;
      }
      if (portal === "team" && user.role === "admin") {
        window.location.assign("/admin");
        return;
      }
      onLogin(user);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`auth-page auth-portal-${portal}`} dir="rtl">
      <StoryPanel portal={portal} theme={theme} endAt={endAt} />
      <section className="auth-panel">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <div className="auth-mobile-brand">
          {portal === "team" ? <HackathonLogo theme={theme} className="mobile-hack-logo" /> : <Brand theme={theme} />}
        </div>
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <span className="auth-form-kicker"><span /> نادي الهمك للذكاء الصنعي والروبوتيك</span>
            <h2>{portal === "admin" ? "دخول الإدارة" : "دخول فرق الهاكاثون"}</h2>
            <p className="auth-form-sub">
              {portal === "admin" ? "اسم المستخدم وكلمة المرور الخاصة بحساب المشرف." : "استخدم حساب الفريق الذي سلّمته لكم إدارة الهاكاثون."}
            </p>
          </div>

          {signedInElsewhere && (
            <div className="auth-alert auth-alert-warning" role="status">
              <LockKeyhole size={17} />
              <span>
                أنت مسجّل حالياً بحساب {signedInElsewhere.role === "admin" ? "إدارة" : "فريق"} ({signedInElsewhere.username}).{" "}
                {signedInElsewhere.role === "admin" ? <a href="/admin">الانتقال للوحة الإدارة</a> : <a href="/">الانتقال لبوابة الفرق</a>}
                {" أو "}
                <button type="button" className="inline-link" onClick={onLogout}>تسجيل الخروج</button>
              </span>
            </div>
          )}

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <CircleHelp size={17} /><span>{error}</span>
              <button type="button" onClick={() => setError("")} aria-label="إغلاق"><X size={15} /></button>
            </div>
          )}
          {help && (
            <div className="auth-alert auth-alert-warning" role="status">
              <LockKeyhole size={17} />
              <span>
                {portal === "admin"
                  ? "حسابات الإدارة تُنشأ من لوحة الحسابات أو من الخادم. تواصل مع مسؤول المنصة."
                  : "لكل فريق حساب واحد بجلسة واحدة. إذا كان الحساب مفتوحاً على جهاز آخر أو نسيت كلمة المرور، تواصل مع مشرف الهاكاثون."}
              </span>
              <button type="button" onClick={() => setHelp(false)} aria-label="إغلاق"><X size={15} /></button>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-username">اسم المستخدم</label>
              <div className="auth-input" dir="ltr">
                <User size={17} />
                <input
                  autoComplete="username"
                  id="login-username"
                  placeholder={portal === "admin" ? "admin" : "team-name"}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoCapitalize="none"
                  spellCheck="false"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button className="auth-password-toggle" type="button" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button className="auth-submit" type="submit" disabled={busy}>
              <span>{busy ? "جارٍ التحقق..." : portal === "admin" ? "دخول لوحة الإدارة" : "دخول إلى الهاكاثون"}</span>
              <ArrowLeft size={18} />
            </button>
          </form>

          <button className="auth-account-help" type="button" onClick={() => setHelp(true)}>
            <CircleHelp size={16} /><span>مساعدة في الدخول</span>
          </button>
          <div className="portal-switch">
            {portal === "admin" ? <a href="/">بوابة الفرق ←</a> : <a href="/admin">دخول الإدارة</a>}
          </div>
        </div>
      </section>
    </main>
  );
}
