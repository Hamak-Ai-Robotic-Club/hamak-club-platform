import { useState } from "react";
import { Check, Eye, FileText, PackageCheck, Printer, RotateCcw, Search, X } from "lucide-react";
import { Api } from "../../api/client.js";
import { ComponentThumb, ErrorBlock, LoadingBlock, Modal, RequestStatus, ReturnStatus, useLoader } from "../../components/ui.jsx";
import { RequestItemsTable, RequestSummary } from "../../components/RequestDetails.jsx";
import { formatDate, nf, requestStatusLabels } from "../../lib/format.js";

function DeliveryForm({ request, onDone, toast }) {
  const deliverable = request.items.filter((item) => item.remainingToDeliver > 0);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(deliverable.map((item) => [item.requestItemId, item.remainingToDeliver])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!deliverable.length) return null;

  async function submit() {
    const items = deliverable
      .map((item) => ({ requestItemId: item.requestItemId, deliveredQuantity: Number(quantities[item.requestItemId]) || 0 }))
      .filter((item) => item.deliveredQuantity > 0);
    if (!items.length) return setError("أدخل كمية تسليم واحدة على الأقل.");
    const over = items.find((item) => item.deliveredQuantity > deliverable.find((d) => d.requestItemId === item.requestItemId).remainingToDeliver);
    if (over) return setError("الكمية تتجاوز المتبقي المعتمد للتسليم.");
    setBusy(true);
    setError("");
    try {
      await Api.deliver(request.id, items);
      toast("تم تسجيل التسليم وخصمه من المخزون العامل");
      onDone();
    } catch (deliverError) {
      setError(deliverError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="action-section">
      <h3><PackageCheck size={16} /> تسجيل التسليم (يمكن على دفعات)</h3>
      <div className="action-rows">
        {deliverable.map((item) => (
          <div key={item.requestItemId} className="action-row">
            <span className="cell-component"><ComponentThumb src={item.componentImageUrl} alt="" /><strong>{item.componentName}</strong></span>
            <small>المتبقي للتسليم <b dir="ltr">{item.remainingToDeliver}</b></small>
            <input
              type="number"
              className="form-input qty-input"
              min="0"
              max={item.remainingToDeliver}
              value={quantities[item.requestItemId]}
              onChange={(event) => setQuantities((current) => ({ ...current, [item.requestItemId]: event.target.value }))}
              aria-label={`كمية تسليم ${item.componentName}`}
              dir="ltr"
            />
          </div>
        ))}
      </div>
      {error && <div className="form-alert error-alert">{error}</div>}
      <button className="button-primary" onClick={submit} disabled={busy}>{busy ? "جارٍ التسجيل..." : "تأكيد التسليم"}</button>
    </section>
  );
}

function ReturnForm({ request, onDone, toast }) {
  const rows = request.items.flatMap((item) =>
    item.deliveryItems
      .filter((delivery) => delivery.outstandingQuantity > 0)
      .map((delivery) => ({ ...delivery, componentName: item.componentName, componentImageUrl: item.componentImageUrl })),
  );
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!rows.length) return null;

  const update = (id, field, value) => setValues((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));

  async function submit() {
    const entries = rows
      .map((row) => ({
        row,
        working: Number(values[row.deliveryItemId]?.working) || 0,
        broken: Number(values[row.deliveryItemId]?.broken) || 0,
      }))
      .filter((entry) => entry.working + entry.broken > 0);
    if (!entries.length) return setError("أدخل كمية إرجاع (سليمة أو عاطلة) لقطعة واحدة على الأقل.");
    const invalid = entries.find((entry) => entry.working < 0 || entry.broken < 0 || entry.working + entry.broken > entry.row.outstandingQuantity);
    if (invalid) return setError(`كمية إرجاع «${invalid.row.componentName}» تتجاوز ما بعهدة الفريق.`);
    setBusy(true);
    setError("");
    try {
      for (const entry of entries) {
        await Api.recordReturn(entry.row.deliveryItemId, entry.working, entry.broken);
      }
      toast("تم تسجيل الإرجاع: السليم عاد للمخزون العامل والعاطل سُجّل عاطلاً");
      onDone();
    } catch (returnError) {
      setError(returnError.message);
      onDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="action-section">
      <h3><RotateCcw size={16} /> تسجيل الإرجاع (سليم / عاطل)</h3>
      <div className="action-rows">
        {rows.map((row) => (
          <div key={row.deliveryItemId} className="action-row action-row-return">
            <span className="cell-component"><ComponentThumb src={row.componentImageUrl} alt="" /><strong>{row.componentName}</strong></span>
            <small>بعهدة الفريق <b dir="ltr">{row.outstandingQuantity}</b></small>
            <label><span>سليم</span><input type="number" min="0" className="form-input qty-input" value={values[row.deliveryItemId]?.working ?? ""} onChange={(event) => update(row.deliveryItemId, "working", event.target.value)} dir="ltr" /></label>
            <label><span>عاطل</span><input type="number" min="0" className="form-input qty-input" value={values[row.deliveryItemId]?.broken ?? ""} onChange={(event) => update(row.deliveryItemId, "broken", event.target.value)} dir="ltr" /></label>
          </div>
        ))}
      </div>
      {error && <div className="form-alert error-alert">{error}</div>}
      <button className="button-primary" onClick={submit} disabled={busy}>{busy ? "جارٍ التسجيل..." : "تأكيد الإرجاع"}</button>
    </section>
  );
}

function ReviewPanel({ request, onDone, toast }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shortages = request.items.filter((item) => item.availableNow !== undefined && item.requestedQuantity > item.availableNow);

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      if (action === "approve") {
        await Api.approve(request.id);
        toast("تم قبول الطلب وحجز الكميات");
      } else {
        await Api.reject(request.id, note.trim() || undefined);
        toast("تم رفض الطلب");
      }
      onDone();
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="action-section">
      <h3>قرار المراجعة (قبول كامل أو رفض كامل)</h3>
      {shortages.length > 0 && (
        <div className="form-alert warning-alert">
          الكمية المتاحة حالياً أقل من المطلوب في: {shortages.map((item) => `${item.componentName} (متاح ${item.availableNow})`).join("، ")}. القبول سيُرفض من الخادم.
        </div>
      )}
      {rejecting ? (
        <>
          <label className="field-label" htmlFor="reject-note">سبب الرفض (يظهر للفريق، اختياري)</label>
          <textarea id="reject-note" className="form-input form-textarea" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="request-review-actions">
            <button className="button-outline" onClick={() => setRejecting(false)} disabled={busy}>رجوع</button>
            <button className="button-danger" onClick={() => run("reject")} disabled={busy}><X size={14} /> تأكيد الرفض</button>
          </div>
        </>
      ) : (
        <div className="request-review-actions">
          <button className="button-danger" onClick={() => setRejecting(true)} disabled={busy}>رفض الطلب</button>
          <button className="button-primary" onClick={() => run("approve")} disabled={busy}><Check size={15} /> قبول وحجز الكميات</button>
        </div>
      )}
      {error && <div className="form-alert error-alert">{error}</div>}
    </section>
  );
}

export default function AdminRequests({ toast, onChanged }) {
  const [archived, setArchived] = useState(false);
  const { data, loading, error, reload } = useLoader(async () => {
    const [requests, catalog] = await Promise.all([Api.requests(archived), Api.adminComponents()]);
    return { requests: requests.items || [], components: catalog.items || [] };
  }, [archived]);
  const [filter, setFilter] = useState("الكل");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const requests = data?.requests || [];
  const availableById = new Map((data?.components || []).map((item) => [item.id, item.availableQuantity]));
  const statuses = ["الكل", "Pending", "Approved", "Partially Delivered", "Delivered", "Rejected"];
  const visible = requests.filter(
    (request) =>
      (filter === "الكل" || request.status === filter || (filter === "open-custody" && request.returnStatus && request.returnStatus !== "Returned")) &&
      `${request.id} ${request.projectName} ${request.teamName} ${request.projectDescription}`.toLowerCase().includes(query.toLowerCase()),
  );
  const counts = requests.reduce((acc, request) => ({ ...acc, [request.status]: (acc[request.status] || 0) + 1 }), {});
  const open = openId ? requests.find((request) => request.id === openId) : null;
  const openWithAvailability = open
    ? { ...open, items: open.items.map((item) => ({ ...item, availableNow: availableById.get(item.componentId) })) }
    : null;

  async function done(keepOpen = false) {
    await reload();
    onChanged?.();
    if (!keepOpen) {
      /* keep the modal open to show the updated request */
    }
  }

  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;

  return (
    <div className="page-content">
      <div className="requests-intro admin-requests-intro">
        <div>
          <span className="section-eyebrow">مركز متابعة الفرق</span>
          <h2>إدارة <span>طلبات الفرق</span></h2>
          <p>القبول يحجز الكميات، التسليم يخصم من العامل، والإرجاع يفصل السليم عن العاطل.</p>
        </div>
        <div className="request-count-card"><span className="count-icon"><FileText size={19} /></span><span><strong>{nf(requests.length)}</strong><small>طلبات {archived ? "(مع المؤرشفة)" : "نشطة"}</small></span></div>
      </div>
      <div className="requests-filter-bar">
        <div className="category-tabs" role="group" aria-label="تصفية الطلبات">
          {statuses.map((status) => (
            <button key={status} className={`category-tab ${filter === status ? "active-tab" : ""}`} onClick={() => setFilter(status)}>
              {status === "الكل" ? "الكل" : requestStatusLabels[status]}
              {status !== "الكل" && counts[status] ? <span className="tab-count">{nf(counts[status])}</span> : null}
            </button>
          ))}
          <button className={`category-tab ${filter === "open-custody" ? "active-tab" : ""}`} onClick={() => setFilter("open-custody")}>عهدة مفتوحة</button>
        </div>
        <label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالفريق أو المشروع أو الرقم..." aria-label="بحث" /></label>
        <label className="toggle-inline"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} /> إظهار المؤرشفة</label>
      </div>
      <section className="panel requests-panel">
        <div className="requests-panel-heading">
          <div><h3>الطلبات</h3><p>افتح الطلب لمراجعة فكرة المشروع والقطع واتخاذ الإجراء.</p></div>
          <button className="export-button" onClick={() => window.print()}><Printer size={15} /> طباعة</button>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table className="requests-table">
              <thead><tr><th>#</th><th>الفريق</th><th>المشروع</th><th>التاريخ</th><th>القطع</th><th>حالة الطلب</th><th>الإرجاع</th><th>الإجراء</th></tr></thead>
              <tbody>
                {visible.map((request) => (
                  <tr key={request.id} className={request.status === "Pending" ? "row-highlight" : ""}>
                    <td><button className="table-id" dir="ltr" onClick={() => setOpenId(request.id)}>#{request.id}</button></td>
                    <td>{request.teamName}</td>
                    <td><button className="table-project" onClick={() => setOpenId(request.id)}>{request.projectName}</button></td>
                    <td className="table-date">{formatDate(request.createdAt, true)}</td>
                    <td><span className="item-count">{nf(request.items.length)} أصناف</span></td>
                    <td><RequestStatus status={request.status} /></td>
                    <td><ReturnStatus status={request.returnStatus} /></td>
                    <td>
                      <button className={request.status === "Pending" ? "admin-approve-row" : "row-action"} onClick={() => setOpenId(request.id)}>
                        {request.status === "Pending" ? "مراجعة" : request.status === "Approved" || request.status === "Partially Delivered" ? "تسليم" : <Eye size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><FileText size={25} /><strong>لا توجد طلبات مطابقة</strong></div>
        )}
      </section>

      {openWithAvailability && (
        <Modal title={openWithAvailability.projectName} eyebrow={`طلب #${openWithAvailability.id} · ${openWithAvailability.teamName || ""}`} wide onClose={() => setOpenId(null)}>
          <RequestSummary request={openWithAvailability} showTeam />
          <h3 className="modal-subtitle">القطع والكميات</h3>
          <RequestItemsTable items={openWithAvailability.items} />
          {openWithAvailability.status === "Pending" && <ReviewPanel key={`r-${openWithAvailability.id}`} request={openWithAvailability} toast={toast} onDone={done} />}
          {["Approved", "Partially Delivered"].includes(openWithAvailability.status) && (
            <DeliveryForm key={`d-${openWithAvailability.id}-${openWithAvailability.status}-${openWithAvailability.items.map((i) => i.deliveredQuantity).join(".")}`} request={openWithAvailability} toast={toast} onDone={done} />
          )}
          <ReturnForm key={`ret-${openWithAvailability.id}-${openWithAvailability.items.map((i) => i.outstandingQuantity).join(".")}`} request={openWithAvailability} toast={toast} onDone={done} />
        </Modal>
      )}
    </div>
  );
}
