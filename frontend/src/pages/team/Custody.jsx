import { CheckCircle2, CircleHelp, Package, PackageCheck, ShieldCheck, Wrench } from "lucide-react";
import { ComponentThumb, ErrorBlock, LoadingBlock, useLoader } from "../../components/ui.jsx";
import { Api } from "../../api/client.js";
import { formatDate, nf } from "../../lib/format.js";

export default function Custody() {
  const { data, loading, error, reload } = useLoader(() => Api.custody(), []);
  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;

  const totals = data?.totals || {};
  const holding = (data?.items || []).filter((item) => item.outstandingQuantity > 0);
  const history = data?.lines || [];

  return (
    <div className="page-content custody-page">
      <section className="custody-hero">
        <div className="custody-hero-copy">
          <span className="section-eyebrow">العهدة المجمّعة عبر كل طلبات الفريق</span>
          <h2>عهدة فريقك، <span>بوضوح.</span></h2>
          <p>القطع التي سُلّمت لفريقك ولم يُسجَّل إرجاعها بعد. يسجّل المشرف الإرجاع عند استلام القطع منكم.</p>
        </div>
        <div className="custody-total">
          <span><Package size={23} /></span>
          <strong>{nf(totals.outstandingQuantity)}</strong>
          <small>قطعة بعهدتكم</small>
        </div>
        <div className="custody-watermark"><Package size={125} strokeWidth={0.75} /></div>
      </section>
      <section className="custody-summary" aria-label="ملخص العهدة">
        <div><span className="custody-summary-icon custody-summary-blue"><PackageCheck size={18} /></span><span><small>إجمالي المسلّم</small><strong>{nf(totals.deliveredQuantity)} قطعة</strong></span></div>
        <div><span className="custody-summary-icon custody-summary-green"><CheckCircle2 size={18} /></span><span><small>أُعيد سليماً</small><strong>{nf(totals.returnedWorkingQuantity)} قطعة</strong></span></div>
        <div><span className="custody-summary-icon custody-summary-red"><Wrench size={18} /></span><span><small>أُعيد عاطلاً</small><strong>{nf(totals.returnedBrokenQuantity)} قطعة</strong></span></div>
      </section>
      <section className="panel custody-panel">
        <div className="requests-panel-heading">
          <div><span className="section-eyebrow">القطع الحالية</span><h3>ما زال بعهدة الفريق</h3><p>مجموع كل نوع قطعة عبر جميع الطلبات.</p></div>
          {data?.custodyClosed && totals.deliveredQuantity > 0 && <span className="status-badge status-returned">العهدة مغلقة</span>}
        </div>
        <div className="custody-list">
          {holding.length ? (
            holding.map((item) => (
              <article className="custody-item" key={item.componentId}>
                <ComponentThumb className="custody-item-image" src={item.imageUrl} alt="" />
                <span className="custody-item-name"><strong>{item.componentName}</strong><span>{item.category}</span></span>
                <span className="custody-item-meta"><small>المسلّم</small><strong dir="ltr">{nf(item.deliveredQuantity)}</strong></span>
                <span className="custody-item-meta"><small>المعاد</small><strong dir="ltr">{nf(item.returnedWorkingQuantity + item.returnedBrokenQuantity)}</strong></span>
                <span className="custody-qty"><small>بعهدتكم</small><strong dir="ltr">× {nf(item.outstandingQuantity)}</strong></span>
              </article>
            ))
          ) : (
            <div className="custody-empty-state">
              <span><Package size={24} /></span>
              <strong>لا توجد قطع بعهدة فريقك حالياً</strong>
              <p>تظهر القطع هنا بعد أن يسجّل المشرف تسليمها لكم.</p>
            </div>
          )}
        </div>
        <div className="custody-panel-foot"><CircleHelp size={15} /><span>العهدة = المسلّم − (المعاد السليم + المعاد العاطل).</span></div>
      </section>
      {history.length > 0 && (
        <section className="panel section-block">
          <div className="requests-panel-heading"><div><span className="section-eyebrow">سجل التسليم</span><h3>دفعات التسليم</h3></div></div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>القطعة</th><th>المشروع</th><th>تاريخ التسليم</th><th>المسلّم</th><th>المعاد</th><th>المتبقي</th></tr></thead>
              <tbody>
                {history.map((line) => (
                  <tr key={line.deliveryItemId}>
                    <td><span className="cell-component"><ComponentThumb src={line.imageUrl} alt="" /><strong>{line.componentName}</strong></span></td>
                    <td>{line.projectName}</td>
                    <td>{formatDate(line.deliveredAt, true)}</td>
                    <td dir="ltr">{nf(line.deliveredQuantity)}</td>
                    <td dir="ltr">{nf(line.returnedWorkingQuantity + line.returnedBrokenQuantity)}</td>
                    <td dir="ltr"><strong>{nf(line.outstandingQuantity)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="custody-notice"><ShieldCheck size={17} /><div><strong>سياسة العهدة</strong><span>يمكن إرسال طلب جديد بعد قبول أو رفض الطلب السابق حتى لو بقيت قطع بعهدتكم. يجب إعادة كل القطع قبل نهاية الهاكاثون.</span></div></div>
    </div>
  );
}
