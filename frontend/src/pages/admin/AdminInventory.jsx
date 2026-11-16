import { useMemo, useRef, useState } from "react";
import { Boxes, CircleHelp, ImagePlus, LayoutGrid, List, Pencil, Plus, Power, Search, Trash2, Upload } from "lucide-react";
import { Api } from "../../api/client.js";
import { ComponentThumb, ConfirmDialog, ErrorBlock, LoadingBlock, Modal, useLoader } from "../../components/ui.jsx";
import { builtInImages, categoryLabel, imageFileToWebp, nf } from "../../lib/format.js";

const emptyForm = { name: "", category: "", description: "", workingQuantity: 0, brokenQuantity: 0, status: "active", imageReference: null };

function ComponentForm({ initial, categories, onClose, onSaved, toast }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: initial.name,
          category: initial.category,
          description: initial.description || "",
          workingQuantity: initial.workingQuantity,
          brokenQuantity: initial.brokenQuantity,
          status: initial.status === "inactive" ? "inactive" : "active",
          imageReference: initial.imageUrl,
        }
      : emptyForm,
  );
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial?.imageUrl || null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function pickFile(event) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("اختر ملف صورة.");
      return;
    }
    try {
      const webp = await imageFileToWebp(picked);
      if (webp.size > 4 * 1024 * 1024) throw new Error("حجم الصورة كبير جداً بعد التحويل.");
      setFile(webp);
      setPreview(URL.createObjectURL(webp));
      setError("");
    } catch (conversionError) {
      setError(conversionError.message);
    }
  }

  function chooseBuiltIn(path) {
    setFile(null);
    setPreview(path);
    setForm((current) => ({ ...current, imageReference: path }));
    setGalleryOpen(false);
  }

  async function save(event) {
    event.preventDefault();
    const working = Number(form.workingQuantity);
    const broken = Number(form.brokenQuantity);
    if (!form.name.trim() || !form.category.trim()) return setError("الاسم والتصنيف مطلوبان.");
    if (!Number.isInteger(working) || working < 0 || !Number.isInteger(broken) || broken < 0) {
      return setError("الكميات يجب أن تكون أعداداً صحيحة غير سالبة.");
    }
    if (!editing && !file && !form.imageReference) return setError("يجب إرفاق صورة لكل قطعة: ارفع صورة أو اختر صورة جاهزة.");
    setBusy(true);
    setError("");
    try {
      const builtIn = !file && form.imageReference && form.imageReference.startsWith("/components/") ? form.imageReference : undefined;
      let saved;
      if (editing) {
        const patch = {};
        if (form.name.trim() !== initial.name) patch.name = form.name.trim();
        if (form.category.trim() !== initial.category) patch.category = form.category.trim();
        if ((form.description.trim() || null) !== (initial.description || null)) patch.description = form.description.trim() || null;
        if (working !== initial.workingQuantity) patch.workingQuantity = working;
        if (broken !== initial.brokenQuantity) patch.brokenQuantity = broken;
        const nextStatus = form.status === "inactive" ? "inactive" : "active";
        if (nextStatus !== (initial.status === "inactive" ? "inactive" : "active")) patch.status = nextStatus;
        if (builtIn && builtIn !== initial.imageUrl) patch.imageReference = builtIn;
        saved = Object.keys(patch).length ? (await Api.updateComponent(initial.id, patch)).item : initial;
      } else {
        saved = (
          await Api.createComponent({
            name: form.name.trim(),
            category: form.category.trim(),
            description: form.description.trim() || null,
            workingQuantity: working,
            brokenQuantity: broken,
            status: "active",
            ...(builtIn ? { imageReference: builtIn } : {}),
          })
        ).item;
      }
      if (file) await Api.uploadComponentImage(saved.id, file);
      toast(editing ? "تم حفظ تعديلات القطعة وتسجيل حركة المخزون" : "تمت إضافة القطعة إلى المخزون");
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `تعديل: ${initial.name}` : "إضافة قطعة جديدة"}
      eyebrow="إدارة المخزون"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button-outline" onClick={onClose} disabled={busy}>إلغاء</button>
          <button type="submit" form="component-form" className="button-primary" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</button>
        </>
      }
    >
      <form id="component-form" className="component-form" onSubmit={save}>
        <div className="component-form-image">
          <div className="image-preview">
            {preview ? <img src={preview} alt="معاينة صورة القطعة" /> : <span><ImagePlus size={32} /><small>صورة القطعة مطلوبة</small></span>}
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickFile} />
          <button type="button" className="button-outline" onClick={() => fileInput.current?.click()}><Upload size={14} /> رفع صورة</button>
          <button type="button" className="button-outline" onClick={() => setGalleryOpen((v) => !v)}><Boxes size={14} /> اختيار صورة جاهزة</button>
          <small className="field-hint">تُحوّل الصورة تلقائياً إلى WEBP وتُصغّر قبل الرفع.</small>
        </div>
        <div className="component-form-fields">
          <label className="field-label" htmlFor="cf-name">اسم القطعة *</label>
          <input id="cf-name" className="form-input" value={form.name} onChange={set("name")} maxLength={120} />
          <label className="field-label" htmlFor="cf-category">التصنيف *</label>
          <input id="cf-category" className="form-input" list="cf-categories" value={form.category} onChange={set("category")} placeholder="Arduino Kit / ESP32 Kit / ..." />
          <datalist id="cf-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          <label className="field-label" htmlFor="cf-description">الوصف / ملاحظات الأعطال والإصلاح</label>
          <textarea id="cf-description" className="form-input form-textarea" rows={3} value={form.description} onChange={set("description")} />
          <div className="form-row-2">
            <div>
              <label className="field-label" htmlFor="cf-working">الكمية العاملة</label>
              <input id="cf-working" className="form-input" type="number" min="0" value={form.workingQuantity} onChange={set("workingQuantity")} dir="ltr" />
            </div>
            <div>
              <label className="field-label" htmlFor="cf-broken">الكمية العاطلة</label>
              <input id="cf-broken" className="form-input" type="number" min="0" value={form.brokenQuantity} onChange={set("brokenQuantity")} dir="ltr" />
            </div>
          </div>
          {editing && (
            <>
              <label className="field-label" htmlFor="cf-status">الحالة</label>
              <select id="cf-status" className="form-input" value={form.status} onChange={set("status")}>
                <option value="active">مفعّلة (تظهر للفرق)</option>
                <option value="inactive">معطّلة (مخفية عن الفرق)</option>
              </select>
              {initial.reservedQuantity > 0 && <small className="field-hint">محجوز حالياً: {nf(initial.reservedQuantity)} — لا يمكن جعل العامل أقل منه.</small>}
            </>
          )}
          <small className="field-hint"><CircleHelp size={13} /> أي تغيير في الكميات يُسجَّل تلقائياً كحركة مخزون وفي سجل التدقيق.</small>
        </div>
      </form>
      {galleryOpen && (
        <div className="image-gallery">
          {builtInImages.map((path) => (
            <button key={path} type="button" className={preview === path ? "selected" : ""} onClick={() => chooseBuiltIn(path)}>
              <img src={path} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {error && <div className="form-alert error-alert">{error}</div>}
    </Modal>
  );
}

export default function AdminInventory({ toast }) {
  const { data, loading, error, reload } = useLoader(() => Api.adminComponents(), []);
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const items = data?.items || [];
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);
  const visible = items.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && item.status !== "inactive") ||
      (filter === "inactive" && item.status === "inactive") ||
      (filter === "low" && item.status !== "inactive" && item.availableQuantity <= 2) ||
      (filter === "broken" && item.brokenQuantity > 0);
    return (
      matchesFilter &&
      (category === "الكل" || item.category === category) &&
      `${item.name} ${item.nameEn || ""} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
  const totals = items.reduce(
    (t, item) => ({
      working: t.working + item.workingQuantity,
      broken: t.broken + item.brokenQuantity,
      reserved: t.reserved + item.reservedQuantity,
      loan: t.loan + item.onLoanQuantity,
    }),
    { working: 0, broken: 0, reserved: 0, loan: 0 },
  );

  async function confirmRemove() {
    setBusy(true);
    try {
      const result = await Api.deleteComponent(removing.id);
      toast(result.deleted ? "حُذفت القطعة نهائياً (لا يوجد لها سجل)" : "للقطعة سجل تاريخي، لذلك تم تعطيلها بدلاً من حذفها");
      setRemoving(null);
      reload();
    } catch (removeError) {
      toast(removeError.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item) {
    try {
      await Api.updateComponent(item.id, { status: item.status === "inactive" ? "active" : "inactive" });
      toast(item.status === "inactive" ? "تم تفعيل القطعة" : "تم تعطيل القطعة");
      reload();
    } catch (toggleError) {
      toast(toggleError.message, "error");
    }
  }

  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;

  return (
    <div className="page-content">
      <section className="admin-welcome">
        <div>
          <span className="section-eyebrow">إدارة المستودع</span>
          <h2>كل قطعة <span>بصورتها وكمياتها</span></h2>
          <p>الإجمالي الفيزيائي = العامل + العاطل · المتاح للفرق = العامل − المحجوز.</p>
        </div>
        <button className="button-primary" onClick={() => setEditing({})}><Plus size={16} /> إضافة قطعة</button>
      </section>
      <section className="inventory-totals">
        <span><small>العامل</small><b dir="ltr">{nf(totals.working)}</b></span>
        <span><small>العاطل</small><b dir="ltr">{nf(totals.broken)}</b></span>
        <span><small>المحجوز</small><b dir="ltr">{nf(totals.reserved)}</b></span>
        <span><small>بعهدة الفرق</small><b dir="ltr">{nf(totals.loan)}</b></span>
        <span><small>الأصناف</small><b dir="ltr">{nf(items.length)}</b></span>
      </section>
      <div className="catalog-toolbar inventory-toolbar">
        <div className="category-tabs" role="group" aria-label="التصنيف">
          {["الكل", ...categories].map((name) => (
            <button key={name} className={`category-tab ${category === name ? "active-tab" : ""}`} onClick={() => setCategory(name)}>{name === "الكل" ? name : categoryLabel(name)}</button>
          ))}
        </div>
        <select className="form-input compact-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="تصفية الحالة">
          <option value="all">كل الحالات</option>
          <option value="active">المفعّلة</option>
          <option value="inactive">المعطّلة</option>
          <option value="low">منخفضة/نافدة</option>
          <option value="broken">بها أعطال</option>
        </select>
        <label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن قطعة..." aria-label="بحث" /></label>
        <div className="view-toggle" role="group" aria-label="طريقة العرض">
          <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="بطاقات"><LayoutGrid size={16} /></button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="قائمة"><List size={16} /></button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="inventory-grid">
          {visible.map((item) => (
            <article key={item.id} className={`inventory-card ${item.status === "inactive" ? "is-inactive" : ""}`}>
              <div className="inventory-card-image">
                <ComponentThumb src={item.imageUrl} alt={item.name} />
                {item.status === "inactive" && <span className="inactive-ribbon">معطّلة</span>}
                <span className="component-category">{categoryLabel(item.category)}</span>
              </div>
              <div className="inventory-card-body">
                <h3>{item.name}</h3>
                {item.nameEn && <small dir="ltr">{item.nameEn}</small>}
                <div className="qty-chips">
                  <span className="chip-good" title="عامل">عامل <b dir="ltr">{item.workingQuantity}</b></span>
                  <span className="chip-bad" title="عاطل">عاطل <b dir="ltr">{item.brokenQuantity}</b></span>
                  <span className="chip-warn" title="محجوز">محجوز <b dir="ltr">{item.reservedQuantity}</b></span>
                  <span className="chip-info" title="متاح">متاح <b dir="ltr">{item.availableQuantity}</b></span>
                  <span className="chip-muted" title="بعهدة الفرق">بعهدة <b dir="ltr">{item.onLoanQuantity}</b></span>
                </div>
                <div className="inventory-card-actions">
                  <button className="button-outline" onClick={() => setEditing(item)}><Pencil size={13} /> تعديل</button>
                  <button className="button-outline" onClick={() => toggleActive(item)}><Power size={13} /> {item.status === "inactive" ? "تفعيل" : "تعطيل"}</button>
                  <button className="button-outline danger-text" onClick={() => setRemoving(item)} aria-label={`حذف ${item.name}`}><Trash2 size={13} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>القطعة</th><th>التصنيف</th><th>الإجمالي</th><th>العامل</th><th>العاطل</th><th>المحجوز</th><th>المتاح</th><th>بعهدة الفرق</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className={item.status === "inactive" ? "row-muted" : ""}>
                    <td><span className="cell-component"><ComponentThumb src={item.imageUrl} alt="" /><span><strong>{item.name}</strong>{item.nameEn && <small dir="ltr">{item.nameEn}</small>}</span></span></td>
                    <td>{categoryLabel(item.category)}</td>
                    <td dir="ltr">{nf(item.workingQuantity + item.brokenQuantity)}</td>
                    <td dir="ltr" className="num-good">{nf(item.workingQuantity)}</td>
                    <td dir="ltr" className="num-bad">{nf(item.brokenQuantity)}</td>
                    <td dir="ltr">{nf(item.reservedQuantity)}</td>
                    <td dir="ltr"><strong>{nf(item.availableQuantity)}</strong></td>
                    <td dir="ltr">{nf(item.onLoanQuantity)}</td>
                    <td>{item.status === "inactive" ? <span className="status-badge status-cancelled">معطّلة</span> : <span className="status-badge status-approved">مفعّلة</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button className="row-action" onClick={() => setEditing(item)} aria-label="تعديل"><Pencil size={15} /></button>
                        <button className="row-action" onClick={() => toggleActive(item)} aria-label="تفعيل/تعطيل"><Power size={15} /></button>
                        <button className="row-action danger-text" onClick={() => setRemoving(item)} aria-label="حذف"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!visible.length && <div className="empty-state"><Search size={25} /><strong>لا توجد قطع مطابقة</strong></div>}

      {editing && (
        <ComponentForm
          initial={editing.id ? editing : null}
          categories={categories}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`حذف «${removing.name}»؟`}
          message="تُحذف القطعة نهائياً فقط إذا لم ترتبط بأي طلب أو حركة مخزون. إذا كان لها سجل سابق ستُعطَّل بدلاً من حذفها حفاظاً على التقارير."
          confirmLabel="متابعة"
          danger
          busy={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
