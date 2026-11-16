import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, LogOut, Menu, RefreshCw, X } from "lucide-react";
import { Brand, HackathonCountdown, HackathonLogo, ThemeToggle, useRemaining } from "./ui.jsx";

export function Sidebar({ account, theme, pages, active, onNavigate, onLogout, open, onClose, sectionLabel }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    function dismiss(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !profileRef.current?.contains(event.target))) {
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, []);
  const isAdmin = account.role === "admin";
  return (
    <>
      {open && <button className="mobile-backdrop" onClick={onClose} aria-label="إغلاق القائمة" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-lockup"><Brand theme={theme} subtitle={isAdmin ? "لوحة الإدارة" : "للذكاء الصنعي والروبوتيك"} /></div>
          <button className="sidebar-close" onClick={onClose} aria-label="إغلاق القائمة"><X size={18} /></button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">{isAdmin ? "م" : (account.teamName || "ف").trim().charAt(0)}</span>
          <span className="workspace-label">
            <strong>{isAdmin ? "إدارة الهاكاثون" : account.teamName || "حساب الفريق"}</strong>
            <small>{isAdmin ? "حساب مشرف" : "حساب فريق"}</small>
          </span>
        </div>
        <span className="nav-section-label">{sectionLabel}</span>
        <nav className="side-nav" aria-label="القائمة الرئيسية">
          {pages.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={`nav-link ${active === id ? "nav-link-active" : ""}`}
              aria-current={active === id ? "page" : undefined}
              onClick={() => {
                onNavigate(id);
                onClose();
              }}
            >
              <Icon size={18} /><span>{label}</span>
              {badge ? <span className="nav-badge nav-badge-live" dir="ltr">{badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-hackathon" aria-hidden="true">
          <HackathonLogo theme={theme} />
        </div>
        <div className="sidebar-profile" ref={profileRef}>
          {profileOpen && (
            <section className="profile-popover" aria-label="الملف الشخصي">
              <span className="profile-popover-kicker">الملف الشخصي</span>
              <strong>{isAdmin ? "مشرف النادي" : account.teamName || "حساب الفريق"}</strong>
              <span className="profile-popover-email" dir="ltr">@{account.username}</span>
              <button type="button" className="profile-logout" onClick={onLogout}><LogOut size={16} /> تسجيل الخروج</button>
            </section>
          )}
          <button className="sidebar-footer" aria-expanded={profileOpen} aria-label="عرض الملف الشخصي" onClick={() => setProfileOpen((v) => !v)}>
            <span className="avatar avatar-small">{isAdmin ? "م" : "ف"}</span>
            <span className="profile-label"><strong>الملف الشخصي</strong><small dir="ltr">@{account.username}</small></span>
            <ChevronDown size={16} className={profileOpen ? "profile-chevron-open" : ""} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ title, subtitle, theme, onToggleTheme, onMenu, endAt, onRefresh, children }) {
  const remaining = useRemaining(endAt);
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenu} aria-label="فتح القائمة"><Menu size={21} /></button>
      <div className="page-heading">
        <span className="breadcrumb">مساحة العمل <ChevronLeft size={13} /> {title}</span>
        <h1>{title}</h1>
        {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
      </div>
      <div className="topbar-actions">
        {endAt ? (
          <div className="topbar-event">
            <HackathonLogo theme="dark" onDark className="topbar-hack-logo" />
            <HackathonCountdown remaining={remaining} />
          </div>
        ) : null}
        {onRefresh && (
          <button className="theme-toggle theme-toggle-compact" type="button" onClick={onRefresh} aria-label="تحديث البيانات" title="تحديث">
            <RefreshCw size={17} />
          </button>
        )}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
        {children}
      </div>
    </header>
  );
}

export function PageIntro({ eyebrow, title, accent, text, aside }) {
  return (
    <div className="page-intro">
      <div>
        <span className="section-eyebrow">{eyebrow}</span>
        <h2>{title} {accent && <span>{accent}</span>}</h2>
        {text && <p>{text}</p>}
      </div>
      {aside}
    </div>
  );
}

export function StatCard({ icon: Icon, tone = "red", label, value, hint }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon stat-${tone}`}><Icon size={19} /></span>
      <span className="stat-content">
        <span>{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </article>
  );
}
