import {
  Activity,
  ClipboardCheck,
  FileCheck2,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Navigation,
  ReceiptText,
  Settings,
  ShieldCheck,
  WalletCards,
  BarChart3,
} from "lucide-react";

const workspaceItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "field-operations", label: "Field Operations", icon: Activity },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "route-proof", label: "RouteProof", icon: Navigation },
  { id: "reviews", label: "Reviews", icon: ClipboardCheck },
  { id: "risk-trust", label: "Risk & Trust", icon: ShieldCheck },
  { id: "field-ledger", label: "Field Ledger", icon: WalletCards },
  { id: "invoice-guard", label: "Invoice Guard", icon: ReceiptText },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "compliance", label: "Compliance", icon: FileText },
];

const systemItems = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: HelpCircle },
];

export default function Sidebar({
  activePage,
  setActivePage,
  user,
  onLogout,
}) {
  const firstName =
    user?.firstName ||
    user?.first_name ||
    "User";

  const lastName =
    user?.lastName ||
    user?.last_name ||
    "";

  const role =
    user?.roles?.[0]?.name ||
    user?.role ||
    "USER";

  function NavItem({ item }) {
    const Icon = item.icon;
    const active = activePage === item.id;

    return (
      <button
        type="button"
        onClick={() => setActivePage(item.id)}
        className={
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition " +
          (active
            ? "bg-slate-800 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white")
        }
      >
        <Icon size={17} />
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
            SL
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900 dark:text-white">
              SafeLayer
            </p>

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Trust Operations
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Workspace
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
            SafeLayer Workspace
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Workspace
        </p>

        <div className="space-y-1">
          {workspaceItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
            />
          ))}
        </div>

        <p className="px-3 pb-2 pt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          System
        </p>

        <div className="space-y-1">
          {systemItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {(firstName.charAt(0) + lastName.charAt(0)).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {firstName} {lastName}
            </p>

            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {role}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition hover:bg-white hover:text-red-500 dark:hover:bg-slate-800"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
