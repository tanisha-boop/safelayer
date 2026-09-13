import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  FileText,
  HelpCircle,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

const items = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "field-operations", label: "Field Operations", icon: Activity },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "route-proof", label: "RouteProof", icon: Navigation,},
  { id: "reviews", label: "Reviews", icon: ClipboardCheck },
  { id: "risk-trust", label: "Risk & Trust", icon: ShieldCheck },
  { id: "field-ledger", label: "Field Ledger", icon: WalletCards },
  { id: "invoice-guard", label: "Invoice Guard", icon: ReceiptText },
  { id: "compliance", label: "Compliance", icon: FileText },
];

export default function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-20 items-center border-b border-slate-100 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
            <ShieldCheck size={22} />
          </div>

          <div>
            <div className="text-lg font-bold tracking-tight text-slate-950">
              SafeLayer
            </div>

            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Trust Operations
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left">
          <div>
            <div className="text-xs font-medium text-slate-400">
              WORKSPACE
            </div>

            <div className="mt-1 text-sm font-semibold text-slate-800">
              Acme Operations
            </div>
          </div>

          <BarChart3 size={16} className="text-slate-400" />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Workspace
        </div>

        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActivePage(id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              activePage === id
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}

        <div className="px-3 pb-2 pt-7 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          System
        </div>

        {[
          { id: "settings", label: "Settings", icon: Settings },
          { id: "help", label: "Help", icon: HelpCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActivePage(id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              activePage === id
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
            SL
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">
              SafeLayer
            </div>

            <div className="truncate text-xs text-slate-400">
              Trust Operations
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
