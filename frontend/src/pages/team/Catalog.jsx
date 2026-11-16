import { useMemo, useState } from "react";
import { ArrowLeft, Boxes, Check, CircleHelp, Filter, Plus, Search, ShieldCheck } from "lucide-react";
import { ComponentThumb, ErrorBlock, LoadingBlock } from "../../components/ui.jsx";
import { categoryLabel, nf } from "../../lib/format.js";

function ComponentCard({ item, inCart, onAdd, locked }) {
  const [quantity, setQuantity] = useState(1);
  const unavailable = item.availableQuantity === 0 || locked;
  const change = (value) => setQuantity(Math.min(Math.max(1, item.availableQuantity), Math.max(1, Math.floor(Number(value)) || 1)));
  const stockClass = item.availableQuantity > 3 ? "in-stock" : item.availableQuantity > 0 ? "low-stock" : "no-stock";
  return (
    <article className="component-card">
      <div className="component-image component-image-photo">
        <ComponentThumb src={item.imageUrl} alt={`${item.name}${item.nameEn ? ` / ${item.nameEn}` : ""}`} />
        <span className="component-image-overlay" />
        <span className="component-category">{categoryLabel(item.category)}</span>
        {item.availableQuantity === 0 && <span className="out-of-stock">غير متاح حالياً</span>}
      </div>
      <div className="component-body">
        <div className="component-title-row">
          <div>
            <h3>{item.name}</h3>
            {item.nameEn && <span className="component-name-en" dir="ltr">{item.nameEn}</span>}
          </div>
          <span className={`component-stock-state ${item.availableQuantity > 0 ? "is-working" : "is-unavailable"}`}>
            <i className={`stock-dot ${stockClass}`} />
            <span>{item.availableQuantity > 3 ? "متاح" : item.availableQuantity > 0 ? "كمية محدودة" : "غير متوفر"}</span>
          </span>
        </div>
        {item.description && <p className="component-description">{item.description}</p>}
        <div className="component-footer">
          <span className="quantity-label">المتاح <strong dir="ltr">{item.availableQuantity}</strong> قطعة</span>
          <div className="component-purchase-controls">
            <div className="component-quantity-control" role="group" aria-label={`كمية ${item.name}`}>
              <button type="button" aria-label="تقليل" disabled={unavailable || quantity <= 1} onClick={() => change(quantity - 1)}>−</button>
              <input type="number" min="1" max={item.availableQuantity} value={quantity} disabled={unavailable} onChange={(event) => change(event.target.value)} aria-label="الكمية" />
              <button type="button" aria-label="زيادة" disabled={unavailable || quantity >= item.availableQuantity} onClick={() => change(quantity + 1)}>+</button>
            </div>
            <button className={`add-component ${inCart ? "added-component" : ""}`} disabled={unavailable} onClick={() => onAdd(item, quantity)}>
              {inCart ? <Check size={16} /> : <Plus size={16} />}
              <span>{inCart ? "تحديث السلة" : "أضف للسلة"}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Catalog({ components, loading, error, onRetry, cart, onAdd, query, onQueryChange, pendingRequest, onNavigate }) {
  const [category, setCategory] = useState("الكل");
  const [availableOnly, setAvailableOnly] = useState(false);
  const categories = useMemo(() => ["الكل", ...new Set(components.map((item) => item.category))], [components]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = components.filter(
    (item) =>
      (category === "الكل" || item.category === category) &&
      `${item.name} ${item.nameEn || ""} ${item.category}`.toLowerCase().includes(normalizedQuery) &&
      (!availableOnly || item.availableQuantity > 0),
  );

  if (loading && !components.length) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !components.length) return <div className="page-content"><ErrorBlock message={error} onRetry={onRetry} /></div>;

  return (
    <div className="page-content">
      <div className="catalog-intro">
        <div>
          <span className="section-eyebrow">اكتشف موارد النادي</span>
          <h2>كل ما يحتاجه مشروعك، <span>هنا.</span></h2>
          <p>تظهر القطع العاملة والكمية المتاحة فعلياً بعد خصم المحجوز للطلبات المعتمدة.</p>
        </div>
        <div className="catalog-total"><Boxes size={18} /><span><strong>{nf(components.length)}</strong> صنفاً في الكتالوج</span></div>
      </div>
      {pendingRequest && (
        <div className="request-lock-notice" role="status">
          <span><ShieldCheck size={18} /><span>طلبك «{pendingRequest.projectName}» قيد المراجعة. يمكنك إرسال طلب جديد بعد قبوله أو رفضه.</span></span>
          <button type="button" onClick={() => onNavigate("requests")}>متابعة الطلب <ArrowLeft size={15} /></button>
        </div>
      )}
      <div className="catalog-toolbar">
        <div className="category-tabs" role="group" aria-label="تصنيف القطع">
          {categories.map((name) => (
            <button key={name} className={`category-tab ${category === name ? "active-tab" : ""}`} aria-pressed={category === name} onClick={() => setCategory(name)}>
              {name === "الكل" ? name : categoryLabel(name)}
            </button>
          ))}
        </div>
        <label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="ابحث بالاسم العربي أو الإنجليزي..." aria-label="ابحث عن قطعة" /></label>
        <button type="button" className={`catalog-availability-toggle ${availableOnly ? "filter-active" : ""}`} aria-pressed={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>
          <Filter size={15} /> {availableOnly ? "عرض كل القطع" : "المتاحة فقط"}
        </button>
      </div>
      <div className="catalog-result-line">
        <span>عرض <strong>{nf(filtered.length)}</strong> صنفاً</span>
        <span><i className="stock-dot in-stock" /> متوفر <i className="stock-dot low-stock" /> كمية محدودة <i className="stock-dot no-stock" /> غير متاح</span>
      </div>
      {filtered.length ? (
        <div className="component-grid catalog-grid">
          {filtered.map((item) => <ComponentCard key={item.id} item={item} inCart={Boolean(cart[item.id])} onAdd={onAdd} locked={Boolean(pendingRequest)} />)}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={27} /><strong>لم نعثر على قطع مطابقة</strong><span>غيّر كلمة البحث أو التصنيف.</span>
          <button onClick={() => { onQueryChange(""); setCategory("الكل"); setAvailableOnly(false); }}>عرض كل القطع</button>
        </div>
      )}
      <div className="stock-disclaimer"><CircleHelp size={16} /> الكميات تُحسب على الخادم: المتاح = العامل − المحجوز للطلبات المعتمدة.</div>
    </div>
  );
}
