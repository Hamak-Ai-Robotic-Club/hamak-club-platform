import { useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, CircleX, KeyRound, ShieldAlert } from "lucide-react";
import { Api } from "../../api/client.js";
import { ErrorBlock, LoadingBlock, useLoader } from "../../components/ui.jsx";
import { formatDate, nf, requestStatusLabels } from "../../lib/format.js";

const PHRASE = "DELETE DATA";
const statusKey = { PENDING: "Pending", APPROVED: "Approved", PARTIALLY_DELIVERED: "Partially Delivered" };

export default function AdminReset({ toast, onChanged }) {
  const { data, loading, error, reload } = useLoader(async () => {
    const [check, summaries] = await Promise.all([Api.resetCheck(), Api.summaries()]);
    return { check, summaries: summaries.items || [] };
  }, []);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultError, setResultError] = useState("");

  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;
  const { check, summaries } = data;
  const ready = check.allowed && phrase === PHRASE && password && acknowledged;

  async function runReset() {
    setBusy(true);
    setResultError("");
    try {
      const result = await Api.resetHackathon(phrase, password);
      toast(`تمت أرشفة ${nf(result.archivedTeams)} فرق وحفظ الملخص النهائي`);
      setPhrase("");
      setPassword("");
      setAcknowledged(false);
      reload();
      onChanged?.();
    } catch (resetError) {
      setResultError(resetError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content reset-page">
      <section className="danger-hero">
        <ShieldAlert size={34} />
        <div>
          <span className="section-eyebrow">إجراء نهائي وحساس</span>
          <h2>تصفير بيانات الهاكاثون</h2>
          <p>يُغلق الهاكاثون: تُعطَّل حسابات الفرق وتُخفى بياناتها وطلباتها من كل الشاشات وتُبطل جلساتها، مع الإبقاء على المخزون والصور وحسابات الإدارة وملخص نهائي لكل قطعة (المعاد السليم والعاطل والكميات النهائية).</p>
          <p className="fine-print">ملاحظة تصميمية: سجلات الطلبات والتسليم والإرجاع محمية في قاعدة البيانات كسجل تاريخي لا يُحذف، لذلك تُؤرشف ولا تُمسح فيزيائياً.</p>
        </div>
      </section>

      <section className="panel section-block reset-checks">
        <h3>شروط السماح (يتحقق منها الخادم)</h3>
        <ul>
          <li className={check.openRequests.length ? "bad" : "good"}>
            {check.openRequests.length ? <CircleX size={16} /> : <CheckCircle2 size={16} />}
            لا توجد طلبات معلّقة أو معتمدة أو مسلّمة جزئياً
            {check.openRequests.length > 0 && <small> — {check.openRequests.map((entry) => `${requestStatusLabels[statusKey[entry.status]]}: ${nf(entry.count)}`).join("، ")}</small>}
          </li>
          <li className={check.outstandingQuantity ? "bad" : "good"}>
            {check.outstandingQuantity ? <CircleX size={16} /> : <CheckCircle2 size={16} />}
            كل العهد مغلقة ولا قطع لدى أي فريق {check.outstandingQuantity > 0 && <small> — {nf(check.outstandingQuantity)} قطعة غير معادة</small>}
          </li>
          <li className="info"><Archive size={16} /> الفرق النشطة التي ستُؤرشف: {nf(check.activeTeams)}</li>
        </ul>
      </section>

      <section className="panel section-block reset-form">
        <h3><KeyRound size={16} /> التأكيد</h3>
        <label className="confirm-warning">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>أفهم أن العملية نهائية، وأنني أخذت نسخة احتياطية من قاعدة البيانات (Supabase → Database → Backups).</span>
        </label>
        <label className="field-label" htmlFor="reset-phrase">اكتب <b dir="ltr">{PHRASE}</b> حرفياً</label>
        <input id="reset-phrase" className="form-input" dir="ltr" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" />
        <label className="field-label" htmlFor="reset-password">أعد إدخال كلمة مرور حسابك</label>
        <input id="reset-password" className="form-input" type="password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        {!check.allowed && <div className="form-alert warning-alert"><AlertTriangle size={15} /> لا يمكن التصفير قبل تحقق جميع الشروط أعلاه.</div>}
        {resultError && <div className="form-alert error-alert">{resultError}</div>}
        <button className="button-danger reset-button" disabled={!ready || busy} onClick={runReset}>{busy ? "جارٍ التنفيذ..." : "تنفيذ التصفير والأرشفة"}</button>
      </section>

      {summaries.length > 0 && (
        <section className="panel section-block">
          <div className="requests-panel-heading"><div><span className="section-eyebrow">ملخصات محفوظة</span><h3>إحصائيات ما بعد التصفير</h3></div></div>
          {summaries.map((summary) => {
            const components = summary.summaryData?.components || [];
            const returnedWorking = components.reduce((t, c) => t + c.returnedWorking, 0);
            const returnedBroken = components.reduce((t, c) => t + c.returnedBroken, 0);
            return (
              <details key={summary.id} className="summary-details">
                <summary>{summary.title || "ملخص"} — {formatDate(summary.createdAt, true)} · فرق مؤرشفة {nf(summary.summaryData?.archivedTeams)} · أُعيد سليماً {nf(returnedWorking)} · عاطلاً {nf(returnedBroken)}</summary>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>القطعة</th><th>أُعيد سليماً</th><th>أُعيد عاطلاً</th><th>العامل النهائي</th><th>العاطل النهائي</th></tr></thead>
                    <tbody>
                      {components.filter((c) => c.returnedWorking || c.returnedBroken || c.finalBrokenQuantity).map((c) => (
                        <tr key={c.componentId}><td>{c.name}</td><td dir="ltr">{nf(c.returnedWorking)}</td><td dir="ltr">{nf(c.returnedBroken)}</td><td dir="ltr">{nf(c.finalWorkingQuantity)}</td><td dir="ltr">{nf(c.finalBrokenQuantity)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
