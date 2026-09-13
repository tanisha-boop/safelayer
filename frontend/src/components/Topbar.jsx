import { Bell, LogOut, Menu, Search } from "lucide-react";

export default function Topbar({
  activePage,
  user,
  setSidebarOpen,
  onLogout,
}) {
  const firstName = user?.firstName || "User";
  const lastName = user?.lastName || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const role =
    user?.roles?.[0]?.name ||
    user?.role ||
    "USER";

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>

        <div>
          <div className="hidden text-xs text-slate-400 sm:block">
            Workspace / {activePage}
          </div>

          <div className="text-sm font-semibold text-slate-800 sm:mt-1">
            {activePage}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
          <Search size={17} className="text-slate-400" />

          <input
            className="w-40 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Search..."
          />

          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
            ⌘ K
          </kbd>
        </div>

        <button
          className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        <div className="hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="group relative">
          <button className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
              {initials}
            </div>

            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold text-slate-800">
                {firstName} {lastName}
              </div>

              <div className="text-[11px] text-slate-400">
                {role}
              </div>
            </div>
          </button>

          <div className="invisible absolute right-0 top-full mt-2 w-44 translate-y-1 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
