import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Boxes, FileText, Home, Package, Plus, ShoppingCart } from "lucide-react";
import { Api } from "../../api/client.js";
import { Sidebar, Topbar } from "../../components/layout.jsx";
import { useRemaining, useToast } from "../../components/ui.jsx";
import TeamHome from "./TeamHome.jsx";
import Catalog from "./Catalog.jsx";
import NewRequest from "./NewRequest.jsx";
import TeamRequests from "./TeamRequests.jsx";
import Custody from "./Custody.jsx";
import Assistant from "./Assistant.jsx";
import CartDrawer from "./CartDrawer.jsx";

const pageInfo = {
  home: ["الرئيسية", "ملخص فريقك في الهاكاثون"],
  catalog: ["كتالوج القطع", "القطع العاملة المتاحة في مخزون النادي"],
  "new-request": ["طلب جديد", "اسم المشروع وفكرته والقطع المطلوبة"],
  requests: ["طلباتي", "حالة الطلبات والتسليم والإرجاع"],
  custody: ["العهدة", "القطع المسلّمة لفريقك وغير المعادة"],
  assistant: ["المساعد التقني", "استشارات الهاكاثون وتوصيات القطع من المخزون"],
};

export default function TeamWorkspace({ account, theme, onToggleTheme, onLogout, endAt }) {
  const [page, setPage] = useState("home");
  const [navOpen, setNavOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [components, setComponents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState({}); // componentId -> quantity
  const [draft, setDraft] = useState({ project: "", members: "", description: "", confirmed: false });
  const [catalogQuery, setCatalogQuery] = useState("");
  const toast = useToast();
  const remaining = useRemaining(endAt);
  const expired = remaining === 0;

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [catalog, list] = await Promise.all([Api.components(), Api.requests()]);
      setComponents(catalog.items || []);
      setRequests(list.items || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const pendingRequest = requests.find((request) => request.status === "Pending") || null;
  const componentById = useMemo(() => new Map(components.map((item) => [item.id, item])), [components]);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);

  function addToCart(item, quantity = 1) {
    if (pendingRequest) {
      toast.show("لديك طلب قيد المراجعة. يمكنك إنشاء طلب جديد بعد قرار المشرف.", "error");
      return;
    }
    const safe = Math.max(1, Math.min(item.availableQuantity, Math.floor(quantity)));
    if (!item.availableQuantity) return;
    setCart((current) => ({ ...current, [item.id]: safe }));
    toast.show(`أُضيف ${safe.toLocaleString("ar-EG")} × ${item.name} إلى السلة`);
  }

  function addManyToCart(items) {
    if (pendingRequest) {
      toast.show("لديك طلب قيد المراجعة. يمكنك إنشاء طلب جديد بعد قرار المشرف.", "error");
      return;
    }
    const additions = {};
    for (const entry of items) {
      const component = componentById.get(entry.componentId);
      if (component && component.availableQuantity > 0) additions[component.id] = cart[component.id] || 1;
    }
    if (!Object.keys(additions).length) {
      toast.show("القطع المقترحة غير متاحة حالياً.", "error");
      return;
    }
    setCart((current) => ({ ...current, ...additions }));
    toast.show("نُقلت القطع المقترحة إلى نموذج الطلب. راجع الكميات قبل الإرسال.");
    setPage("new-request");
  }

  function setQuantity(id, quantity) {
    const item = componentById.get(id);
    if (!item) return;
    setCart((current) => ({ ...current, [id]: Math.max(1, Math.min(item.availableQuantity || 1, Math.floor(quantity) || 1)) }));
  }

  function removeFromCart(id) {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function submitRequest(payload) {
    const created = await Api.createRequest(payload);
    setCart({});
    setDraft({ project: "", members: "", description: "", confirmed: false });
    await refresh(true);
    setPage("requests");
    toast.show("تم إرسال طلبك للمراجعة");
    return created;
  }

  async function cancelRequest(id) {
    await Api.cancelRequest(id);
    await refresh(true);
    toast.show("تم إلغاء الطلب");
  }

  const pages = [
    { id: "home", label: "الرئيسية", icon: Home },
    { id: "catalog", label: "كتالوج القطع", icon: Boxes },
    { id: "new-request", label: "طلب جديد", icon: Plus, badge: cartCount ? cartCount : null },
    { id: "requests", label: "طلباتي", icon: FileText, badge: pendingRequest ? "1" : null },
    { id: "custody", label: "العهدة", icon: Package },
    { id: "assistant", label: "المساعد التقني", icon: Bot },
  ];
  const [title, subtitle] = pageInfo[page];
  const common = { components, requests, loading, error, onRetry: () => refresh(), theme };

  return (
    <div className="app-shell app-shell-team" dir="rtl">
      <Sidebar account={account} theme={theme} pages={pages} active={page} onNavigate={setPage} onLogout={onLogout} open={navOpen} onClose={() => setNavOpen(false)} sectionLabel="مساحة الفريق" />
      <main className="main-column">
        <Topbar title={title} subtitle={subtitle} theme={theme} onToggleTheme={onToggleTheme} onMenu={() => setNavOpen(true)} endAt={endAt} onRefresh={() => refresh()}>
          <button className="theme-toggle theme-toggle-compact cart-button" aria-label={`سلة القطع، ${cartCount} قطعة`} aria-expanded={cartOpen} onClick={() => setCartOpen((v) => !v)}>
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="cart-count" dir="ltr">{cartCount}</span>}
          </button>
        </Topbar>

        {page === "home" && <TeamHome {...common} account={account} pendingRequest={pendingRequest} onNavigate={setPage} />}
        {page === "catalog" && (
          <Catalog {...common} cart={cart} onAdd={addToCart} query={catalogQuery} onQueryChange={setCatalogQuery} pendingRequest={pendingRequest} onNavigate={setPage} />
        )}
        {page === "new-request" && (
          <NewRequest
            {...common}
            cart={cart}
            componentById={componentById}
            draft={draft}
            onDraftChange={(changes) => setDraft((current) => ({ ...current, ...changes }))}
            onQuantity={setQuantity}
            onRemove={removeFromCart}
            onNavigate={setPage}
            onSubmit={submitRequest}
            pendingRequest={pendingRequest}
            expired={expired}
          />
        )}
        {page === "requests" && <TeamRequests {...common} onCancel={cancelRequest} onNavigate={setPage} />}
        {page === "custody" && <Custody theme={theme} />}
        {page === "assistant" && <Assistant theme={theme} onAddMany={addManyToCart} pendingRequest={pendingRequest} />}
      </main>
      <CartDrawer
        open={cartOpen}
        cart={cart}
        componentById={componentById}
        onClose={() => setCartOpen(false)}
        onRemove={removeFromCart}
        onContinue={() => {
          setCartOpen(false);
          setPage(Object.keys(cart).length ? "new-request" : "catalog");
        }}
      />
      {toast.element}
    </div>
  );
}
