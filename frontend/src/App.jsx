import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import Evidence from "./components/Evidence";
import FieldLedger from "./components/FieldLedger";
import InvoiceGuard from "./components/InvoiceGuard";
import FieldOperations from "./components/FieldOperations";
import Login from "./components/Login";
import Reviews from "./components/Reviews";
import RiskTrust from "./components/RiskTrust";
import Reports from "./components/Reports";
import Compliance from "./components/Compliance";
import Settings from "./components/Settings";
import Help from "./components/Help";
import RouteProof from "./components/RouteProof";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { api } from "./services/api";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("overview");
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("safelayer-theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("safelayer-theme", theme);
  }, [theme]);

  useEffect(() => {
    async function loadSession() {
      try {
        const result = await api.getMe();
        setUser(result?.data?.user || result?.user || null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

  async function handleLogin(email, password) {
    await api.login(email, password);
    const result = await api.getMe();
    setUser(result?.data?.user || result?.user || null);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setActivePage("overview");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading SafeLayer...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        onLogout={handleLogout}
      />

      <div className="ml-64 min-h-screen">
        <Topbar
          activePage={activePage}
          user={user}
          setActivePage={setActivePage}
          setNavigationTarget={setNavigationTarget}
          onLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="p-6">
  {activePage === "overview" && <Dashboard user={user} setActivePage={setActivePage} />}

  {activePage === "field-operations" && (
    <FieldOperations
      user={user}
      navigationTarget={navigationTarget}
      setNavigationTarget={setNavigationTarget}
    />
  )}

  {activePage === "evidence" && (
    <Evidence
      user={user}
      navigationTarget={navigationTarget}
      setNavigationTarget={setNavigationTarget}
    />
  )}

  {activePage === "route-proof" && (
    <RouteProof user={user} />
  )}

  {activePage === "field-ledger" && (
    <FieldLedger
      user={user}
      navigationTarget={navigationTarget}
      setNavigationTarget={setNavigationTarget}
    />
  )}

  {activePage === "invoice-guard" && (
    <InvoiceGuard
      user={user}
      navigationTarget={navigationTarget}
      setNavigationTarget={setNavigationTarget}
    />
  )}

  {activePage === "reviews" && (
    <Reviews user={user} />
  )}

  {activePage === "reports" && (
        <Reports user={user} />
      )}

      {activePage === "risk-trust" && (
    <RiskTrust user={user} />
  )}

  {activePage === "compliance" && (
    <Compliance
      user={user}
      navigationTarget={navigationTarget}
      setNavigationTarget={setNavigationTarget}
    />
  )}

  {activePage === "settings" && (
    <Settings user={user} theme={theme} />
  )}

  {activePage === "help" && (
    <Help />
  )}

  {activePage !== "overview" &&
    activePage !== "field-operations" &&
    activePage !== "evidence" &&
    activePage !== "route-proof" && 
    activePage !== "field-ledger" &&
    activePage !== "invoice-guard" &&
    activePage !== "reviews" &&
    activePage !== "risk-trust" &&
    activePage !== "reports" &&
    activePage !== "compliance" &&
    activePage !== "settings" &&
    activePage !== "help" &&
    (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Coming soon
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This SafeLayer module is planned for the next implementation
          stage.
        </p>
      </section>
    )}
</main>
      </div>
    </div>
  );
}

export default App;
