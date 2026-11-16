import { useState } from "react";
import { Package, RotateCcw, Search, Users } from "lucide-react";
import { Api } from "../../api/client.js";
import { ComponentThumb, ErrorBlock, LoadingBlock, Modal, useLoader } from "../../components/ui.jsx";
import { nf } from "../../lib/format.js";

function ReturnDialog({ line, onClose, onSaved, toast }) {
  const [working, setWorking] = useState(String(line.outstandingQuantity));
  const [broken, setBroken] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const w = Number(working) || 0;
    const b = Number(broken) || 0;
    if (w < 0 || b < 0 || !Number.isInteger(w) || !Number.isInteger(b)) return setError("أدخل أعداداً صحيحة غير سالبة.");
    if (w + b === 0) return setError("أدخل كمية إرجاع واحدة على الأقل.");
    if (w + b > line.outstandingQuantity) return setError("الإرجاع يتجاوز ما بعهدة الفريق.");
    setBusy(true);
    try {
      await Api.recordReturn(line.deliveryItemId, w, b);
      toast("تم تسجيل الإرجاع");
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`إرجاع: ${line.componentName}`}
      eyebrow={`${line.teamName} · ${line.projectName || ""}`}
      onClose={onClose}
      footer={<><button className="button-outline" onClick={onClose} disabled={busy}>إلغاء</button><button className="button-primary" onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ..." : "تسجيل الإرجاع"}</button></>}
    >
      <p className="modal-message">بعهدة الفريق من هذه الدفعة: <b dir="ltr">{line.outstandingQuantity}</b>. السليم يعود للمخزون العامل، والعاطل يُسجَّل عاطلاً ولا يزيد المتاح.</p>
      <div className="form-row-2">
        <div><label className="field-label">سليم</label><input type="number" min="0" className="form-input" value={working} onChange={(event) => setWorking(event.target.value)} dir="ltr" /></div>
        <div><label className="field-label">عاطل</label><input type="number" min="0" className="form-input" value={broken} onChange={(event) => setBroken(event.target.value)} dir="ltr" /></div>
      </div>
      {error && <div className="form-alert error-alert">{error}</div>}
    </Modal>
  );
}

export default function AdminCustody({ toast, onChanged }) {
  const { data, loading, error, reload } = useLoader(async () => {
    const [outstanding, catalog] = await Promise.all([Api.outstanding(), Api.adminComponents()]);
    const images = new Map((catalog.items || []).map((item) => [item.id, item.imageUrl]));
    return (outstanding.items || []).map((line) => ({ ...line, imageUrl: images.get(line.componentId) }));
  }, []);
  const [query, setQuery] = useState("");
  const [returning, setReturning] = useState(null);

  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;

  const lines = (data || []).filter((line) => `${line.teamName} ${line.componentName} ${line.projectName}`.toLowerCase().includes(query.toLowerCase()));
  const byTeam = lines.reduce((groups, line) => {
    (groups[line.teamName] ||= []).push(line);
    return groups;
  }, {});
  const total = (data || []).reduce((sum, line) => sum + line.outstandingQuantity, 0);

  return (
    <div className="page-content">
      <section className="custody-hero">
        <div className="custody-hero-copy">
          <span className="section-eyebrow">العهد المفتوحة</span>
          <h2>ما زال <span>لدى الفرق</span></h2>
          <p>كل دفعة تسليم لم يُسجّل إرجاعها بالكامل. سجّل الإرجاع عند استلام القطع مع فصل السليم عن العاطل.</p>
        </div>
        <div className="custody-total"><span><Package size={23} /></span><strong>{nf(total)}</strong><small>قطعة لدى {nf(Object.keys(byTeam).length)} فرق</small></div>
      </section>
      <div className="catalog-toolbar">
        <label className="catalog-search wide-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالفريق أو القطعة..." aria-label="بحث" /></label>
      </div>
      {Object.keys(byTeam).length ? (
        Object.entries(byTeam).map(([team, teamLines]) => (
          <section key={team} className="panel section-block">
            <div className="requests-panel-heading">
              <div><span className="section-eyebrow"><Users size={12} /> فريق</span><h3>{team}</h3></div>
              <span className="status-badge status-return-pending">{nf(teamLines.reduce((s, l) => s + l.outstandingQuantity, 0))} قطعة</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>القطعة</th><th>المشروع / الطلب</th><th>المسلّم</th><th>أُعيد سليماً</th><th>أُعيد عاطلاً</th><th>المتبقي</th><th></th></tr></thead>
                <tbody>
                  {teamLines.map((line) => (
                    <tr key={line.deliveryItemId}>
                      <td><span className="cell-component"><ComponentThumb src={line.imageUrl} alt="" /><strong>{line.componentName}</strong></span></td>
                      <td>{line.projectName} <small dir="ltr">#{line.requestId}</small></td>
                      <td dir="ltr">{nf(line.deliveredQuantity)}</td>
                      <td dir="ltr" className="num-good">{nf(line.returnedWorkingQuantity)}</td>
                      <td dir="ltr" className="num-bad">{nf(line.returnedBrokenQuantity)}</td>
                      <td dir="ltr"><strong>{nf(line.outstandingQuantity)}</strong></td>
                      <td><button className="admin-approve-row" onClick={() => setReturning(line)}><RotateCcw size={13} /> إرجاع</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state"><Package size={26} /><strong>لا توجد عهد مفتوحة</strong><span>كل القطع المسلّمة أُعيدت.</span></div>
      )}
      {returning && (
        <ReturnDialog
          line={returning}
          toast={toast}
          onClose={() => setReturning(null)}
          onSaved={() => {
            setReturning(null);
            reload();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
