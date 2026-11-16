import { ComponentThumb, RequestStatus, ReturnStatus } from "./ui.jsx";
import { formatDate, nf } from "../lib/format.js";

export function RequestItemsTable({ items, showReturns = true }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>القطعة</th>
            <th>المطلوب</th>
            <th>المعتمد</th>
            <th>المسلّم</th>
            {showReturns && <th>أُعيد سليماً</th>}
            {showReturns && <th>أُعيد عاطلاً</th>}
            {showReturns && <th>بعهدة الفريق</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.requestItemId}>
              <td>
                <span className="cell-component">
                  <ComponentThumb src={item.componentImageUrl} alt="" />
                  <strong>{item.componentName}</strong>
                </span>
              </td>
              <td dir="ltr">{nf(item.requestedQuantity)}</td>
              <td dir="ltr">{nf(item.approvedQuantity)}</td>
              <td dir="ltr">{nf(item.deliveredQuantity)}</td>
              {showReturns && <td dir="ltr" className="num-good">{nf(item.returnedWorkingQuantity)}</td>}
              {showReturns && <td dir="ltr" className="num-bad">{nf(item.returnedBrokenQuantity)}</td>}
              {showReturns && <td dir="ltr"><strong>{nf(item.outstandingQuantity)}</strong></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RequestSummary({ request, showTeam = false }) {
  return (
    <>
      <div className="modal-details detail-grid">
        {showTeam && <div><span>الفريق</span><strong>{request.teamName || "—"}</strong></div>}
        <div><span>رقم الطلب</span><strong dir="ltr">#{request.id}</strong></div>
        <div><span>تاريخ التقديم</span><strong>{formatDate(request.createdAt, true)}</strong></div>
        <div><span>حالة الطلب</span><RequestStatus status={request.status} /></div>
        <div><span>حالة الإرجاع</span><ReturnStatus status={request.returnStatus} /></div>
        {request.reviewedAt && <div><span>تاريخ المراجعة</span><strong>{formatDate(request.reviewedAt, true)}</strong></div>}
      </div>
      <section className="request-modal-description">
        <h3>فكرة المشروع</h3>
        <p>{request.projectDescription}</p>
      </section>
      {request.note && (
        <section className="review-note">
          <h3>ملاحظة المشرف</h3>
          <p>{request.note}</p>
        </section>
      )}
    </>
  );
}
