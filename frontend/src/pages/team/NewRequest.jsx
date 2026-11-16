import { useState } from "react";
import { ArrowLeft, Boxes, Check, CircleHelp, FileText, LockKeyhole, Plus, ShieldCheck, Users, X } from "lucide-react";
import { ComponentThumb, ConfirmDialog, RequestStatus } from "../../components/ui.jsx";
import { nf } from "../../lib/format.js";

const MAX_DESCRIPTION = 1000;

function composeDescription(draft) {
  const members = draft.members
    .split(/[\n,،]+/)
    .map((member) => member.trim())
    .filter(Boolean);
  const base = draft.description.trim();
  return members.length ? `${base}\n\nأعضاء الفريق: ${members.join("، ")}` : base;
}

export default function NewRequest({ cart, componentById, draft, onDraftChange, onQuantity, onRemove, onNavigate, onSubmit, pendingRequest, expired }) {
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const chosen = Object.entries(cart)
    .map(([id, quantity]) => ({ item: componentById.get(id), quantity }))
    .filter((entry) => entry.item);
  const total = chosen.reduce((sum, entry) => sum + entry.quantity, 0);
  const description = composeDescription(draft);

  if (pendingRequest) {
    return (
      <div className="page-content">
        <div className="request-lock-panel">
          <span className="request-lock-icon"><LockKeyhole size={23} /></span>
          <h2>طلبك قيد المراجعة</h2>
          <p>يُسمح بطلب واحد فقط بحالة «قيد المراجعة» لكل فريق. بعد قبول الطلب أو رفضه يمكنك إنشاء طلب جديد، ويمكنك إلغاء الطلب الحالي قبل مراجعته.</p>
          <button type="button" className="button-primary" onClick={() => onNavigate("requests")}>عرض طلباتي <ArrowLeft size={16} /></button>
        </div>
      </div>
    );
  }

  function validate() {
    if (expired) return "انتهى وقت الهاكاثون ولا يمكن إرسال طلبات جديدة.";
    if (!draft.project.trim()) return "أدخل اسم المشروع.";
    if (draft.project.trim().length > 100) return "اسم المشروع يجب ألا يتجاوز 100 حرف.";
    if (!draft.description.trim()) return "اشرح فكرة المشروع ومبدأ عمله.";
    if (description.length > MAX_DESCRIPTION) return `الشرح وأسماء الأعضاء معاً يجب ألا تتجاوز ${MAX_DESCRIPTION} حرف.`;
    if (!chosen.length) return "أضف قطعة واحدة على الأقل من الكتالوج.";
    const invalid = chosen.find((entry) => entry.quantity < 1 || entry.quantity > entry.item.availableQuantity);
    if (invalid) return `الكمية المطلوبة من «${invalid.item.name}» تتجاوز المتاح.`;
    if (!draft.confirmed) return "أكّد أنك راجعت الطلب وأنه لا يمكن تعديله بعد الإرسال.";
    return "";
  }

  function openConfirm(event) {
    event.preventDefault();
    const message = validate();
    setError(message);
    if (!message) setConfirming(true);
  }

  async function send() {
    setBusy(true);
    try {
      await onSubmit({
        projectName: draft.project.trim(),
        projectDescription: description,
        items: chosen.map((entry) => ({ componentId: entry.item.id, quantity: entry.quantity })),
      });
      setConfirming(false);
    } catch (submitError) {
      setConfirming(false);
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content">
      <div className="request-intro">
        <div>
          <span className="section-eyebrow">طلب تجهيز مشروعك</span>
          <h2>فكرتك تستحق <span>أن تُبنى.</span></h2>
          <p>اسم المشروع وشرحه يُحفظان مع هذا الطلب نفسه، ويمكنك تقديم طلبات لاحقة لمشاريع أو مراحل مختلفة.</p>
        </div>
        <div className="steps-indicator"><span className="step-active"><i>١</i> تفاصيل المشروع</span><span className="step-connector" /><span><i>٢</i> مراجعة وإرسال</span></div>
      </div>
      {error && <div className="form-alert error-alert request-error" role="alert"><CircleHelp size={17} />{error}</div>}
      <form className="request-layout" onSubmit={openConfirm}>
        <div className="request-main">
          <section className="panel form-panel">
            <div className="panel-title"><span className="panel-step">٠١</span><div><h3>تفاصيل المشروع</h3><p>المعلومات التي يحتاجها المشرف لمراجعة طلبك.</p></div><FileText size={20} /></div>
            <label className="field-label" htmlFor="request-project">اسم المشروع <span>*</span></label>
            <input id="request-project" className="form-input" maxLength={100} placeholder="مثال: روبوت استكشاف ذكي" value={draft.project} onChange={(event) => onDraftChange({ project: event.target.value })} />
            <label className="field-label" htmlFor="request-description">فكرة المشروع ومبدأ عمله <span>*</span></label>
            <textarea id="request-description" className="form-input form-textarea" rows={5} placeholder="اشرح الفكرة، المشكلة التي تحلها، وطريقة عمل النظام باختصار..." value={draft.description} onChange={(event) => onDraftChange({ description: event.target.value })} />
            <label className="field-label" htmlFor="request-members">أسماء أعضاء الفريق (اختياري)</label>
            <textarea id="request-members" className="form-input form-textarea request-members-input" rows={2} placeholder={"اسم في كل سطر أو مفصولة بفواصل"} value={draft.members} onChange={(event) => onDraftChange({ members: event.target.value })} />
            <div className="field-hint"><Users size={14} /> تُضاف الأسماء إلى شرح المشروع. <span className={description.length > MAX_DESCRIPTION ? "hint-over" : ""} dir="ltr">{description.length}/{MAX_DESCRIPTION}</span></div>
          </section>
          <section className="panel form-panel selected-panel">
            <div className="panel-title"><span className="panel-step">٠٢</span><div><h3>القطع المطلوبة <span className="title-bubble">{nf(chosen.length)}</span></h3><p>الكمية القصوى لكل قطعة هي المتاح حالياً.</p></div><Boxes size={20} /></div>
            {chosen.length ? (
              <div className="selected-list">
                {chosen.map(({ item, quantity }) => (
                  <div className="selected-item" key={item.id}>
                    <ComponentThumb className="selected-item-image" src={item.imageUrl} alt="" />
                    <span className="selected-name"><strong>{item.name}</strong>{item.nameEn && <small dir="ltr">{item.nameEn}</small>}</span>
                    <span className="selected-available">متاح <b dir="ltr">{item.availableQuantity}</b></span>
                    <div className="component-quantity-control" role="group" aria-label={`كمية ${item.name}`}>
                      <button type="button" disabled={quantity <= 1} onClick={() => onQuantity(item.id, quantity - 1)}>−</button>
                      <input type="number" min="1" max={item.availableQuantity} value={quantity} onChange={(event) => onQuantity(item.id, Number(event.target.value))} aria-label="الكمية" />
                      <button type="button" disabled={quantity >= item.availableQuantity} onClick={() => onQuantity(item.id, quantity + 1)}>+</button>
                    </div>
                    <button type="button" className="remove-item" aria-label={`حذف ${item.name}`} onClick={() => onRemove(item.id)}><X size={16} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-selection"><div><Boxes size={22} /></div><strong>لم تضف أي قطعة بعد</strong><span>تصفّح الكتالوج أو اطلب توصية من المساعد التقني.</span><button type="button" onClick={() => onNavigate("catalog")}>تصفّح القطع <ArrowLeft size={14} /></button></div>
            )}
            <button type="button" className="add-more-button" onClick={() => onNavigate("catalog")}><Plus size={16} /> أضف قطعاً أخرى من الكتالوج</button>
          </section>
        </div>
        <aside className="request-aside">
          <section className="panel summary-panel">
            <div className="summary-title"><span>ملخص الطلب</span><span className="draft-label"><i /> مسودة</span></div>
            <div className="summary-project"><span>المشروع</span><strong>{draft.project || "سيظهر اسم مشروعك هنا"}</strong></div>
            <div className="summary-line"><span>أنواع القطع</span><strong>{nf(chosen.length)}</strong></div>
            <div className="summary-line"><span>إجمالي الكمية</span><strong>{nf(total)} قطعة</strong></div>
            <div className="summary-line"><span>الحالة بعد الإرسال</span><RequestStatus status="Pending" /></div>
            <div className="summary-divider" />
            <label className="confirm-warning">
              <input type="checkbox" checked={draft.confirmed} onChange={(event) => onDraftChange({ confirmed: event.target.checked })} />
              <span className="confirm-check"><Check size={13} /></span>
              <span>راجعت الطلب، وأفهم أنه <strong>لا يمكن تعديله بعد الإرسال.</strong></span>
            </label>
            <button className="button-primary submit-request-button" type="submit" disabled={expired}>
              <span>{expired ? "Time's Up!" : "إرسال الطلب للمراجعة"}</span>{!expired && <ArrowLeft size={17} />}
            </button>
            <div className="secure-note"><ShieldCheck size={14} /> لا تُحجز القطع قبل موافقة المشرف.</div>
          </section>
        </aside>
      </form>
      {confirming && (
        <ConfirmDialog
          title="تأكيد إرسال الطلب"
          message="بعد الإرسال لن يكون الطلب قابلاً للتعديل. يمكنك إلغاؤه فقط قبل أن يراجعه المشرف."
          confirmLabel="تأكيد الإرسال"
          busy={busy}
          onConfirm={send}
          onClose={() => setConfirming(false)}
        >
          <div className="confirm-summary">
            <strong>{draft.project}</strong>
            <span>{nf(chosen.length)} أصناف · {nf(total)} قطعة</span>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
