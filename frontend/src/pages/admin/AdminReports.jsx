import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { Api } from "../../api/client.js";
import { ComponentThumb, ErrorBlock, LoadingBlock, useLoader } from "../../components/ui.jsx";
import { auditLabels, categoryLabel, formatDate, movementLabels, nf } from "../../lib/format.js";

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Pager({ offset, limit, total, onChange }) {
  return (
    <div className="pager">
      <button className="row-action" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} aria-label="السابق"><ChevronRight size={16} /></button>
      <span dir="ltr">{nf(Math.min(total, offset + 1))}–{nf(Math.min(total, offset + limit))} / {nf(total)}</span>
      <button className="row-action" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)} aria-label="التالي"><ChevronLeft size={16} /></button>
    </div>
  );
}

function InventoryReport() {
  const { data, loading, error, reload } = useLoader(() => Api.adminComponents(), []);
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  const items = data.items;
  const rows = [["القطعة", "English", "التصنيف", "الإجمالي", "العامل", "العاطل", "المحجوز", "المتاح", "بعهدة الفرق", "الحالة"]].concat(
    items.map((item) => [item.name, item.nameEn, item.category, item.workingQuantity + item.brokenQuantity, item.workingQuantity, item.brokenQuantity, item.reservedQuantity, item.availableQuantity, item.onLoanQuantity, item.status]),
  );
  return (
    <section className="panel">
      <div className="requests-panel-heading">
        <div><h3>تقرير المخزون</h3><p>الإجمالي والعامل والعاطل والمحجوز والمتاح وما بعهدة الفرق لكل صنف.</p></div>
        <div className="row-actions">
          <button className="export-button" onClick={() => downloadCsv("inventory-report.csv", rows)}><Download size={15} /> CSV</button>
          <button className="export-button" onClick={() => window.print()}><Printer size={15} /> طباعة</button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>{rows[0].filter((_, i) => i !== 1).map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.status === "inactive" ? "row-muted" : ""}>
                <td><span className="cell-component"><ComponentThumb src={item.imageUrl} alt="" /><strong>{item.name}</strong></span></td>
                <td>{categoryLabel(item.category)}</td>
                <td dir="ltr">{nf(item.workingQuantity + item.brokenQuantity)}</td>
                <td dir="ltr" className="num-good">{nf(item.workingQuantity)}</td>
                <td dir="ltr" className="num-bad">{nf(item.brokenQuantity)}</td>
                <td dir="ltr">{nf(item.reservedQuantity)}</td>
                <td dir="ltr"><strong>{nf(item.availableQuantity)}</strong></td>
                <td dir="ltr">{nf(item.onLoanQuantity)}</td>
                <td>{item.status === "inactive" ? "معطّلة" : "مفعّلة"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MovementsReport() {
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, loading, error, reload } = useLoader(() => Api.movements(offset, limit), [offset]);
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <section className="panel">
      <div className="requests-panel-heading">
        <div><h3>حركات المخزون</h3><p>سجل إلحاقي لا يُعدَّل: الإضافة والتعديل والتسليم والإرجاع.</p></div>
        <Pager offset={offset} limit={limit} total={data.total} onChange={setOffset} />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>التاريخ</th><th>القطعة</th><th>نوع الحركة</th><th>الرصيد</th><th>التغيير</th><th>المنفّذ</th><th>ملاحظات</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.occurredAt, true)}</td>
                <td>{item.componentName}</td>
                <td>{movementLabels[item.movementType] || item.movementType}</td>
                <td>{item.quantityBucket === "working" ? "عامل" : "عاطل"}</td>
                <td dir="ltr" className={item.quantityDelta > 0 ? "num-good" : "num-bad"}>{item.quantityDelta > 0 ? "+" : ""}{nf(item.quantityDelta)}</td>
                <td>{item.actor || "النظام"}</td>
                <td className="cell-note">{item.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditReport() {
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, loading, error, reload } = useLoader(() => Api.auditLogs(offset, limit), [offset]);
  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <section className="panel">
      <div className="requests-panel-heading">
        <div><h3>سجل التدقيق</h3><p>العمليات الإدارية والأمنية المهمة (لا يحتوي كلمات مرور أو رموز).</p></div>
        <Pager offset={offset} limit={limit} total={data.total} onChange={setOffset} />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>التاريخ</th><th>المنفّذ</th><th>العملية</th><th>الكيان</th><th>التفاصيل</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.occurredAt, true)}</td>
                <td dir="ltr">{item.actor ? `@${item.actor.username || item.actor.displayName}` : "—"}</td>
                <td>{auditLabels[item.action] || item.action}</td>
                <td dir="ltr">{item.entityType} #{item.entityId}</td>
                <td className="cell-note" dir="ltr">{JSON.stringify(item.afterData ?? item.beforeData ?? {}).slice(0, 140)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminReports() {
  const [tab, setTab] = useState("inventory");
  return (
    <div className="page-content">
      <section className="admin-welcome">
        <div>
          <span className="section-eyebrow">التقارير</span>
          <h2>بيانات موثوقة <span>من الخادم</span></h2>
          <p>كل الأرقام محسوبة في قاعدة البيانات من سجل الحركات والطلبات.</p>
        </div>
      </section>
      <div className="category-tabs report-tabs" role="tablist">
        {[["inventory", "المخزون"], ["movements", "حركات المخزون"], ["audit", "سجل التدقيق"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`category-tab ${tab === id ? "active-tab" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "inventory" && <InventoryReport />}
      {tab === "movements" && <MovementsReport />}
      {tab === "audit" && <AuditReport />}
    </div>
  );
}
