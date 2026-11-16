import { useCallback, useEffect, useState } from "react";
import { BarChart3, Boxes, FileText, LayoutDashboard, Package, ShieldAlert, Users } from "lucide-react";
import { Api } from "../../api/client.js";
import { Sidebar, Topbar } from "../../components/layout.jsx";
import { useToast } from "../../components/ui.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import AdminInventory from "./AdminInventory.jsx";
import AdminRequests from "./AdminRequests.jsx";
import AdminCustody from "./AdminCustody.jsx";
import AdminUsers from "./AdminUsers.jsx";
import AdminReports from "./AdminReports.jsx";
import AdminReset from "./AdminReset.jsx";

const pageInfo = {
  dashboard: ["لوحة التحكم", "حالة النظام والمخزون والطلبات"],
  inventory: ["إدارة المخزون", "القطع والصور والكميات العاملة والعاطلة"],
  requests: ["طلبات الفرق", "المراجعة والقبول والتسليم والإرجاع"],
  custody: ["العهد المفتوحة", "القطع الموجودة لدى الفرق"],
  users: ["الحسابات", "حسابات الفرق والإدارة والجلسات"],
  reports: ["التقارير والتدقيق", "المخزون والحركات وسجل العمليات"],
  reset: ["تصفير الهاكاثون", "أرشفة بيانات الفرق بعد إغلاق العهد"],
};

export default function AdminWorkspace({ account, theme, onToggleTheme, onLogout, endAt }) {
  const [page, setPage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();

  const loadBadge = useCallback(() => {
    Api.dashboard()
      .then((data) => setPending(data.pendingRequests || 0))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadBadge();
    const timer = window.setInterval(loadBadge, 30000);
    return () => window.clearInterval(timer);
  }, [loadBadge, refreshKey]);


  const pages = [
    { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { id: "requests", label: "طلبات الفرق", icon: FileText, badge: pending || null },
    { id: "inventory", label: "إدارة المخزون", icon: Boxes },
    { id: "custody", label: "العهد المفتوحة", icon: Package },
    { id: "users", label: "الحسابات", icon: Users },
    { id: "reports", label: "التقارير والتدقيق", icon: BarChart3 },
    { id: "reset", label: "تصفير الهاكاثون", icon: ShieldAlert },
  ];
  const [title, subtitle] = pageInfo[page];
  const common = { theme, toast: toast.show, onChanged: loadBadge, account };

  return (
    <div className="app-shell app-shell-admin" dir="rtl">
      <Sidebar account={account} theme={theme} pages={pages} active={page} onNavigate={setPage} onLogout={onLogout} open={navOpen} onClose={() => setNavOpen(false)} sectionLabel="إدارة المنصة" />
      <main className="main-column">
        <Topbar title={title} subtitle={subtitle} theme={theme} onToggleTheme={onToggleTheme} onMenu={() => setNavOpen(true)} endAt={endAt} onRefresh={() => setRefreshKey((key) => key + 1)} />
        {page === "dashboard" && <AdminDashboard key={refreshKey} {...common} onNavigate={setPage} />}
        {page === "inventory" && <AdminInventory key={refreshKey} {...common} />}
        {page === "requests" && <AdminRequests key={refreshKey} {...common} />}
        {page === "custody" && <AdminCustody key={refreshKey} {...common} />}
        {page === "users" && <AdminUsers key={refreshKey} {...common} />}
        {page === "reports" && <AdminReports key={refreshKey} {...common} />}
        {page === "reset" && <AdminReset key={refreshKey} {...common} />}
      </main>
      {toast.element}
    </div>
  );
}
