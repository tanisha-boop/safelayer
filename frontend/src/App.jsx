import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import Evidence from "./components/Evidence";
import FieldLedger from "./components/FieldLedger";
import FieldOperations from "./components/FieldOperations";
import Login from "./components/Login";
import RouteProof from "./components/RouteProof";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { api } from "./services/api";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("overview");

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
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="rounded-2xl bg-white px-8 py-6 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
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
    <div className="min-h-screen bg-slate-100">
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
          onLogout={handleLogout}
        />

        <main className="p-6">
  {activePage === "overview" && <Dashboard user={user} />}

  {activePage === "field-operations" && (
    <FieldOperations user={user} />
  )}

  {activePage === "evidence" && (
    <Evidence user={user} />
  )}

  {activePage === "route-proof" && (
    <RouteProof user={user} />
  )}

  {activePage === "field-ledger" && (
    <FieldLedger user={user} />
  )}

  {activePage !== "overview" &&
    activePage !== "field-operations" &&
    activePage !== "evidence" &&
    activePage !== "route-proof" && 
    activePage !== "field-ledger" &&
    (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Coming soon
        </h1>

        <p className="mt-2 text-sm text-slate-500">
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
