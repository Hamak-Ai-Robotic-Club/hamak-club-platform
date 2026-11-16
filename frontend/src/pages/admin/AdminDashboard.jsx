import { AlertTriangle, ArrowLeft, Boxes, CheckCircle2, Clock3, FileText, Package, Users, Wrench } from "lucide-react";
import { Api } from "../../api/client.js";
import { StatCard } from "../../components/layout.jsx";
import { ComponentThumb, ErrorBlock, HackathonLogo, LoadingBlock, RequestStatus, useLoader } from "../../components/ui.jsx";
import { formatDate, nf, requestStatusLabels } from "../../lib/format.js";

const statusKey = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PARTIALLY_DELIVERED: "Partially Delivered",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export default function AdminDashboard({ theme, onNavigate }) {
  const { data, loading, error, reload } = useLoader(async () => {
    const [dashboard, catalog, requests] = await Promise.all([Api.dashboard(), Api.adminComponents(), Api.requests()]);
    return { dashboard, components: catalog.items || [], requests: requests.items || [] };
  }, []);

  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;

  const { dashboard, components, requests } = data;
  const active = components.filter((item) => item.status !== "inactive");
  const reserved = active.reduce((total, item) => total + item.reservedQuantity, 0);
  const available = active.reduce((total, item) => total + item.availableQuantity, 0);
  const lowStock = active.filter((item) => item.availableQuantity <= 2).sort((a, b) => a.availableQuantity - b.availableQuantity);
  const pending = requests.filter((request) => request.status === "Pending");
  const toDeliver = requests.filter((request) => ["Approved", "Partially Delivered"].includes(request.status));
  const byStatus = dashboard.requests?.byStatus || [];
  const maxStatus = Math.max(1, ...byStatus.map((entry) => entry.count));

  return (
    <div className="page-content">
      <section className="admin-hero">
        <div>
          <span className="section-eyebrow">مركز المراقبة</span>
          <h2>حالة الهاكاثون <span>لحظة بلحظة</span></h2>
          <p>المخزون الفعلي، الحجوزات، العهد المفتوحة، والطلبات بانتظار قرارك.</p>
          <div className="welcome-actions">
            <button className="button-primary" onClick={() => onNavigate("requests")}><FileText size={16} /> مراجعة الطلبات ({nf(pending.length)})</button>
            <button className="welcome-secondary" onClick={() => onNavigate("inventory")}>إدارة المخزون <ArrowLeft size={15} /></button>
          </div>
        </div>
        <HackathonLogo theme={theme} onDark className="admin-hero-logo" />
      </section>

      <section className="stats-grid stats-grid-6">
        <StatCard icon={Boxes} tone="blue" label="أصناف المخزون" value={nf(active.length)} hint={`${nf(components.length - active.length)} معطلة`} />
        <StatCard icon={CheckCircle2} tone="green" label="العامل" value={nf(dashboard.inventory.workingQuantity)} hint={`المتاح للفرق ${nf(available)}`} />
        <StatCard icon={Clock3} tone="amber" label="المحجوز" value={nf(reserved)} hint="معتمد ولم يُسلَّم" />
        <StatCard icon={Package} tone="red" label="بعهدة الفرق" value={nf(dashboard.custody.outstandingQuantity)} hint={`سُلّم ${nf(dashboard.custody.deliveredQuantity)}`} />
        <StatCard icon={Wrench} tone="rose" label="العاطل" value={nf(dashboard.inventory.brokenQuantity)} hint={`أعيد عاطلاً ${nf(dashboard.custody.returnedBrokenQuantity)}`} />
        <StatCard icon={Users} tone="violet" label="الفرق النشطة" value={nf(dashboard.activeTeams)} hint={`${nf(dashboard.pendingRequests)} طلبات معلّقة`} />
      </section>

      <div className="dashboard-columns">
        <section className="panel dash-panel">
          <div className="requests-panel-heading"><div><span className="section-eyebrow">بانتظار قرارك</span><h3>طلبات قيد المراجعة</h3></div><button className="subtle-link" onClick={() => onNavigate("requests")}>الكل <ArrowLeft size={14} /></button></div>
          {pending.length ? (
            <ul className="dash-list">
              {pending.slice(0, 6).map((request) => (
                <li key={request.id}>
                  <span><strong>{request.projectName}</strong><small>{request.teamName} · {formatDate(request.createdAt, true)}</small></span>
                  <RequestStatus status={request.status} />
                </li>
              ))}
            </ul>
          ) : <p className="dash-empty">لا توجد طلبات معلّقة الآن.</p>}
          {toDeliver.length > 0 && (
            <div className="dash-callout"><Package size={16} /> {nf(toDeliver.length)} طلبات معتمدة بانتظار التسليم.</div>
          )}
        </section>

        <section className="panel dash-panel">
          <div className="requests-panel-heading"><div><span className="section-eyebrow">توزيع الحالات</span><h3>الطلبات حسب الحالة</h3></div></div>
          {byStatus.length ? (
            <div className="bar-list">
              {byStatus.map((entry) => (
                <div key={entry.status} className="bar-row">
                  <span>{requestStatusLabels[statusKey[entry.status]] || entry.status}</span>
                  <span className="bar-track"><i style={{ width: `${(entry.count / maxStatus) * 100}%` }} /></span>
                  <b dir="ltr">{nf(entry.count)}</b>
                </div>
              ))}
            </div>
          ) : <p className="dash-empty">لم تُرسل طلبات بعد.</p>}
        </section>
      </div>

      <section className="panel section-block dash-panel">
        <div className="requests-panel-heading"><div><span className="section-eyebrow">تنبيه المخزون</span><h3><AlertTriangle size={16} /> قطع منخفضة أو نافدة</h3></div><button className="subtle-link" onClick={() => onNavigate("inventory")}>المخزون <ArrowLeft size={14} /></button></div>
        {lowStock.length ? (
          <div className="low-stock-grid">
            {lowStock.slice(0, 12).map((item) => (
              <article key={item.id} className="low-stock-card">
                <ComponentThumb src={item.imageUrl} alt="" />
                <span><strong>{item.name}</strong><small>متاح <b dir="ltr">{item.availableQuantity}</b> · محجوز <b dir="ltr">{item.reservedQuantity}</b> · بعهدة <b dir="ltr">{item.onLoanQuantity}</b></small></span>
              </article>
            ))}
          </div>
        ) : <p className="dash-empty">كل القطع متوفرة بكميات جيدة.</p>}
      </section>
    </div>
  );
}
