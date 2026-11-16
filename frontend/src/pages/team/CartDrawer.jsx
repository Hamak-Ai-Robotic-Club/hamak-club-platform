import { ArrowLeft, ShoppingCart, X } from "lucide-react";
import { ComponentThumb } from "../../components/ui.jsx";

export default function CartDrawer({ open, cart, componentById, onClose, onRemove, onContinue }) {
  if (!open) return null;
  const entries = Object.entries(cart)
    .map(([id, quantity]) => ({ item: componentById.get(id), quantity }))
    .filter((entry) => entry.item);
  return (
    <div className="cart-drawer-layer">
      <button className="cart-backdrop" onClick={onClose} aria-label="إغلاق سلة القطع" />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header className="cart-drawer-header">
          <div><span className="cart-drawer-kicker">طلبك الحالي</span><h2 id="cart-title">سلة القطع <span dir="ltr">{entries.length}</span></h2></div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق السلة"><X size={18} /></button>
        </header>
        {entries.length ? (
          <>
            <div className="cart-drawer-items">
              {entries.map(({ item, quantity }) => (
                <article className="cart-drawer-item" key={item.id}>
                  <ComponentThumb src={item.imageUrl} alt="" />
                  <span className="cart-drawer-item-copy">
                    <strong>{item.name}</strong>
                    {item.nameEn && <small className="item-name-en" dir="ltr">{item.nameEn}</small>}
                    <small>الكمية: <b dir="ltr">{quantity}</b> · المتاح <b dir="ltr">{item.availableQuantity}</b></small>
                  </span>
                  <button className="cart-remove-button" onClick={() => onRemove(item.id)} aria-label={`حذف ${item.name}`}><X size={15} /></button>
                </article>
              ))}
            </div>
            <button className="button-primary cart-continue-button" onClick={onContinue}>متابعة الطلب <ArrowLeft size={16} /></button>
          </>
        ) : (
          <div className="cart-empty-state">
            <ShoppingCart size={27} /><strong>سلتك فارغة حالياً</strong><span>أضف قطعاً من الكتالوج للبدء بطلبك.</span>
            <button onClick={onContinue}>استكشف القطع <ArrowLeft size={15} /></button>
          </div>
        )}
      </aside>
    </div>
  );
}
