import { ArrowLeft, Bot, Boxes, Clock3, Cpu, FileText, Package, Plus, Sparkles } from "lucide-react";
import { StatCard } from "../../components/layout.jsx";
import { ComponentThumb, ErrorBlock, HackathonLogo, LoadingBlock, RequestStatus } from "../../components/ui.jsx";
import { formatDate, nf } from "../../lib/format.js";

export default function TeamHome({ account, components, requests, loading, error, onRetry, pendingRequest, onNavigate, theme }) {
  if (loading && !components.length) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !components.length) return <div className="page-content"><ErrorBlock message={error} onRetry={onRetry} /></div>;

  const available = components.filter((item) => item.availableQuantity > 0);
  const delivered = requests.reduce(
    (total, request) => total + request.items.reduce((sum, item) => sum + item.outstandingQuantity, 0),
    0,
  );
  const latest = requests[0];

  return (
    <div className="page-content">
      <section className="welcome-banner hack-banner">
        <div className="welcome-copy">
          <span className="welcome-kicker"><span className="live-dot" /> لوحة فريقك</span>
          <h2>أهلاً {account.teamName || "بفريقك"} <span>✦</span></h2>
          <p>حوّل فكرتك إلى نموذج يعمل: اختر القطع، أرسل طلبك، وتابع التسليم والعهدة.</p>
          <div className="welcome-actions">
            <button className="button-primary" onClick={() => onNavigate(pendingRequest ? "requests" : "catalog")}>
              {pendingRequest ? <FileText size={17} /> : <Plus size={17} />} {pendingRequest ? "متابعة الطلب الحالي" : "ابدأ طلب قطع"}
            </button>
            <button className="welcome-secondary" onClick={() => onNavigate("assistant")}>
              <Bot size={16} /> اسأل المساعد التقني <ArrowLeft size={16} />
            </button>
          </div>
        </div>
        <div className="welcome-art hack-banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <HackathonLogo theme={theme} onDark className="banner-hack-logo" />
          <div className="welcome-art-label"><Sparkles size={14} /> حوّل فكرتك إلى واقع</div>
        </div>
        <span className="banner-grain" />
      </section>

      <section className="stats-grid">
        <StatCard icon={FileText} tone="red" label="طلبات الفريق" value={nf(requests.length)} hint="غير الملغاة" />
        <StatCard icon={Clock3} tone="amber" label="قيد المراجعة" value={nf(pendingRequest ? 1 : 0)} hint="طلب واحد كحد أقصى" />
        <StatCard icon={Package} tone="blue" label="بعهدة الفريق" value={nf(delivered)} hint="قطع مسلّمة غير معادة" />
        <StatCard icon={Boxes} tone="green" label="أصناف متاحة" value={nf(available.length)} hint={`من ${nf(components.length)} صنفاً`} />
      </section>

      {latest && (
        <section className="section-block">
          <div className="section-heading">
            <div><span className="section-eyebrow">آخر طلب</span><h2>{latest.projectName}</h2></div>
            <button className="subtle-link" onClick={() => onNavigate("requests")}>كل الطلبات <ArrowLeft size={15} /></button>
          </div>
          <div className="panel latest-request">
            <div className="latest-request-meta">
              <RequestStatus status={latest.status} />
              <span>{formatDate(latest.createdAt, true)}</span>
              <span>{nf(latest.items.length)} أصناف</span>
            </div>
            <div className="mini-thumbs">
              {latest.items.slice(0, 8).map((item) => (
                <span key={item.requestItemId} className="mini-thumb" title={item.componentName}>
                  <ComponentThumb src={item.componentImageUrl} alt={item.componentName} />
                  <b dir="ltr">×{item.requestedQuantity}</b>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section-block">
        <div className="section-heading">
          <div><span className="section-eyebrow">من مخزون النادي</span><h2>قطع متاحة الآن</h2></div>
          <button className="subtle-link" onClick={() => onNavigate("catalog")}>عرض الكتالوج <ArrowLeft size={15} /></button>
        </div>
        <div className="home-strip">
          {available.slice(0, 8).map((item) => (
            <button key={item.id} type="button" className="home-strip-card" onClick={() => onNavigate("catalog")}>
              <ComponentThumb src={item.imageUrl} alt={item.name} />
              <strong>{item.name}</strong>
              <small>المتاح <b dir="ltr">{item.availableQuantity}</b></small>
            </button>
          ))}
          {!available.length && <div className="empty-state"><Cpu size={24} /><strong>لا توجد قطع متاحة حالياً</strong></div>}
        </div>
      </section>
      <footer className="page-footer"><span>© نادي الهمك للذكاء الصنعي والروبوتيك</span><span>منصة لوجستيات هاكاثون الهمك</span></footer>
    </div>
  );
}
