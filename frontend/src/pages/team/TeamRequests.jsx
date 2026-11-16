import { useState } from "react";
import { ChevronLeft, FileText, Plus, Search, ShieldCheck } from "lucide-react";
import { ConfirmDialog, ErrorBlock, LoadingBlock, Modal, RequestStatus, ReturnStatus } from "../../components/ui.jsx";
import { RequestItemsTable, RequestSummary } from "../../components/RequestDetails.jsx";
import { formatDate, nf, requestStatusLabels } from "../../lib/format.js";

export default function TeamRequests({ requests, loading, error, onRetry, onCancel, onNavigate }) {
  const [filter, setFilter] = useState("الكل");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const statuses = ["الكل", ...Object.keys(requestStatusLabels).filter((status) => status !== "Cancelled")];
  const visible = requests.filter(
    (request) =>
      (filter === "الكل" || request.status === filter) &&
      `${request.id} ${request.projectName} ${request.projectDescription}`.toLowerCase().includes(query.toLowerCase()),
  );
  const current = viewing ? requests.find((request) => request.id === viewing) : null;

  async function confirmCancel() {
    setBusy(true);
    setCancelError("");
    try {
      await onCancel(cancelId);
      setCancelId(null);
    } catch (error) {
      setCancelError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !requests.length) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !requests.length) return <div className="page-content"><ErrorBlock message={error} onRetry={onRetry} /></div>;

  return (
    <div className="page-content">
      <div className="requests-intro">
        <div>
          <span className="section-eyebrow">متابعة المشاريع</span>
          <h2>طلباتك، <span>خطوة بخطوة.</span></h2>
          <p>حالة الطلب منفصلة عن حالة الإرجاع: قد يُسلّم الطلب بالكامل وتبقى قطع بعهدتكم.</p>
        </div>
        <div className="request-count-card"><span className="count-icon"><FileText size={19} /></span><span><strong>{nf(requests.length)}</strong><small>إجمالي الطلبات</small></span></div>
      </div>
      <div className="requests-filter-bar">
        <div className="category-tabs" role="group" aria-label="تصفية الطلبات">
          {statuses.map((status) => (
            <button key={status} className={`category-tab ${filter === status ? "active-tab" : ""}`} aria-pressed={filter === status} onClick={() => setFilter(status)}>
              {status === "الكل" ? status : requestStatusLabels[status]}
            </button>
          ))}
        </div>
        <label className="catalog-search"><Search size={16} /><input aria-label="بحث" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الطلب أو المشروع..." /></label>
      </div>
      <section className="panel requests-panel">
        <div className="requests-panel-heading">
          <div><h3>سجل الطلبات</h3><p>اضغط على الطلب لعرض القطع والكميات المعتمدة والمسلّمة والمعادة.</p></div>
          <button className="button-primary" onClick={() => onNavigate("new-request")}><Plus size={15} /> طلب جديد</button>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table className="requests-table">
              <thead><tr><th>رقم الطلب</th><th>المشروع</th><th>تاريخ التقديم</th><th>القطع</th><th>حالة الطلب</th><th>الإرجاع</th><th>الإجراء</th></tr></thead>
              <tbody>
                {visible.map((request) => (
                  <tr key={request.id}>
                    <td><button className="table-id" dir="ltr" onClick={() => setViewing(request.id)}>#{request.id}</button></td>
                    <td><button className="table-project" onClick={() => setViewing(request.id)}>{request.projectName}</button></td>
                    <td className="table-date">{formatDate(request.createdAt)}</td>
                    <td><span className="item-count">{nf(request.items.length)} أصناف</span></td>
                    <td><RequestStatus status={request.status} /></td>
                    <td><ReturnStatus status={request.returnStatus} /></td>
                    <td>
                      {request.status === "Pending" ? (
                        <button className="cancel-request" onClick={() => setCancelId(request.id)}>إلغاء الطلب</button>
                      ) : (
                        <button className="row-action" aria-label={`عرض الطلب ${request.id}`} onClick={() => setViewing(request.id)}><ChevronLeft size={17} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={25} />
            <strong>{requests.length ? "لا توجد طلبات مطابقة" : "لم يرسل فريقك أي طلب بعد"}</strong>
            <span>{requests.length ? "غيّر التصفية أو البحث." : "ابدأ من الكتالوج واختر القطع التي تحتاجها."}</span>
            <button onClick={() => (requests.length ? (setFilter("الكل"), setQuery("")) : onNavigate("catalog"))}>{requests.length ? "إعادة ضبط" : "تصفّح الكتالوج"}</button>
          </div>
        )}
      </section>
      <div className="requests-footnote"><ShieldCheck size={15} /> يمكن إلغاء الطلب فقط قبل أن يراجعه المشرف، ويُحتفظ بسجل الإلغاء داخلياً.</div>

      {current && (
        <Modal title={current.projectName} eyebrow="تفاصيل الطلب" wide onClose={() => setViewing(null)}>
          <RequestSummary request={current} />
          <h3 className="modal-subtitle">القطع</h3>
          <RequestItemsTable items={current.items} />
        </Modal>
      )}
      {cancelId && (
        <ConfirmDialog
          title="إلغاء هذا الطلب؟"
          message="يمكن الإلغاء قبل المراجعة فقط، ولا يمكن التراجع عن هذا الإجراء."
          confirmLabel="نعم، ألغِ الطلب"
          danger
          busy={busy}
          onConfirm={confirmCancel}
          onClose={() => { setCancelId(null); setCancelError(""); }}
        >
          {cancelError && <div className="form-alert error-alert">{cancelError}</div>}
        </ConfirmDialog>
      )}
    </div>
  );
}
