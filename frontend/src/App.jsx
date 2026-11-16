import { useEffect, useState } from "react";
import { Api, onUnauthorized } from "./api/client.js";
import { LoadingBlock, useEventConfig, useTheme } from "./components/ui.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import TeamWorkspace from "./pages/team/TeamWorkspace.jsx";
import AdminWorkspace from "./pages/admin/AdminWorkspace.jsx";

// Two separate interfaces on one deployment:
//   /        → team (student) portal: catalogue, requests, custody, assistant
//   /admin   → admin console: inventory, review/delivery/returns, accounts, reports
// The server enforces every permission; the split here is only for UX.
function currentPortal() {
  return window.location.pathname.replace(/\/+$/, "").startsWith("/admin") ? "admin" : "team";
}

export default function App() {
  const { theme, toggle } = useTheme();
  const endAt = useEventConfig();
  const [portal] = useState(currentPortal);
  const [account, setAccount] = useState(undefined);

  useEffect(() => {
    onUnauthorized(() => setAccount(null));
    Api.me()
      .then((data) => setAccount(data?.user || null))
      .catch(() => setAccount(null));
  }, []);

  async function logout() {
    try {
      await Api.logout();
    } catch {
      /* session may already be gone */
    }
    setAccount(null);
  }

  if (account === undefined) {
    return (
      <main className="boot-screen" dir="rtl">
        <img src={theme === "dark" ? "/brand/hackathon-logo-white.webp" : "/brand/hackathon-logo-red.webp"} alt="هاكاثون الهمك" />
        <LoadingBlock />
      </main>
    );
  }

  const wrongPortal =
    account && ((portal === "admin" && account.role !== "admin") || (portal === "team" && account.role === "admin"));

  if (!account || wrongPortal) {
    return (
      <LoginPage
        portal={portal}
        theme={theme}
        onToggleTheme={toggle}
        endAt={endAt}
        signedInElsewhere={wrongPortal ? account : null}
        onLogout={logout}
        onLogin={setAccount}
      />
    );
  }

  return account.role === "admin" ? (
    <AdminWorkspace account={account} theme={theme} onToggleTheme={toggle} onLogout={logout} endAt={endAt} />
  ) : (
    <TeamWorkspace account={account} theme={theme} onToggleTheme={toggle} onLogout={logout} endAt={endAt} />
  );
}
