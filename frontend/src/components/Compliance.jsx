import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Plus,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const initialRequirements = [
  {
    id: 1,
    name: "Business Permit",
    type: "Permit",
    owner: "Operations",
    expiry: "2026-10-18",
    evidence: 2,
    status: "Active",
  },
  {
    id: 2,
    name: "Worker Safety Certification",
    type: "Certification",
    owner: "Field Operations",
    expiry: "2026-09-28",
    evidence: 1,
    status: "Expiring soon",
  },
  {
    id: 3,
    name: "Insurance Coverage",
    type: "Insurance",
    owner: "Finance",
    expiry: "2026-12-14",
    evidence: 3,
    status: "Active",
  },
  {
    id: 4,
    name: "Equipment Registration",
    type: "Registration",
    owner: "Operations",
    expiry: "2026-09-12",
    evidence: 1,
    status: "Expired",
  },
  {
    id: 5,
    name: "Site Safety Permit",
    type: "Permit",
    owner: "Site Management",
    expiry: "2026-10-04",
    evidence: 0,
    status: "Pending verification",
  },
  {
    id: 6,
    name: "Contractor Accreditation",
    type: "License",
    owner: "Operations",
    expiry: "2026-11-22",
    evidence: 2,
    status: "Active",
  },
];

const statusClasses = {
  Active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "Expiring soon": "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Expired: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  "Pending verification": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function formatDate(value) {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function daysUntil(value) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T00:00:00`);
  return Math.ceil((date - today) / 86400000);
}

export default function Compliance() {
  const [requirements, setRequirements] = useState(initialRequirements);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    return requirements.filter((item) => {
      const matchesQuery =
        !query ||
        `${item.name} ${item.type} ${item.owner}`
          .toLowerCase()
          .includes(query.toLowerCase());

      const matchesFilter = filter === "All" || item.status === filter;

      return matchesQuery && matchesFilter;
    });
  }, [requirements, query, filter]);

  const counts = {
    total: requirements.length,
    active: requirements.filter((x) => x.status === "Active").length,
    expiring: requirements.filter((x) => x.status === "Expiring soon").length,
    overdue: requirements.filter((x) => x.status === "Expired").length,
  };

  function addRequirement(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const newRequirement = {
      id: Date.now(),
      name: form.get("name"),
      type: form.get("type"),
      owner: form.get("owner"),
      expiry: form.get("expiry"),
      evidence: 0,
      status: "Pending verification",
    };

    setRequirements((current) => [newRequirement, ...current]);
    setShowAdd(false);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <ShieldCheck size={17} />
            Governance & operational readiness
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Compliance Control Center
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Monitor permits, licenses, certifications, insurance, evidence, and
            renewal readiness from one operational control surface.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <Plus size={17} />
          Add requirement
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total requirements", counts.total, ClipboardCheck, "text-slate-600 dark:text-slate-300"],
          ["Compliant", counts.active, CheckCircle2, "text-emerald-600 dark:text-emerald-400"],
          ["Expiring soon", counts.expiring, CalendarClock, "text-amber-600 dark:text-amber-400"],
          ["Overdue", counts.overdue, XCircle, "text-red-600 dark:text-red-400"],
        ].map(([label, value, Icon, iconClass]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <Icon size={18} className={iconClass} />
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Compliance register
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                A centralized register of operational requirements and supporting evidence.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search requirements..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option>All</option>
                <option>Active</option>
                <option>Expiring soon</option>
                <option>Expired</option>
                <option>Pending verification</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
              <tr>
                {["Requirement", "Type", "Owner", "Expiry", "Status", "Evidence", "Action"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((item) => {
                const days = daysUntil(item.expiry);

                return (
                  <tr
                    key={item.id}
                    className="transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Requirement #{String(item.id).padStart(4, "0")}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {item.type}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {item.owner}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatDate(item.expiry)}
                      </p>
                      <p className={`mt-1 text-xs ${days < 0 ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}`}>
                        {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <FileCheck2 size={16} />
                        {item.evidence} {item.evidence === 1 ? "file" : "files"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <button className="text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">
              No requirements found
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Try a different search or filter.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <CalendarClock className="text-amber-600 dark:text-amber-400" size={20} />
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Upcoming expirations
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Requirements that need attention before they become operational blockers.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {requirements
              .filter((item) => item.status === "Expiring soon" || item.status === "Pending verification")
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(item.expiry)} · {item.owner}
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Attention
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={20} />
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Compliance readiness
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Evidence-backed requirements are easier to verify and audit.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                Active requirements
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {counts.active} / {counts.total}
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${counts.total ? (counts.active / counts.total) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evidence attached
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {requirements.reduce((sum, item) => sum + item.evidence, 0)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Needs action
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {counts.expiring + counts.overdue}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={addRequirement}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  Add compliance requirement
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create a requirement for your operational register.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <input
                name="name"
                required
                placeholder="Requirement name"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  name="type"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option>Permit</option>
                  <option>License</option>
                  <option>Certification</option>
                  <option>Insurance</option>
                  <option>Registration</option>
                  <option>Contract</option>
                  <option>Other</option>
                </select>

                <input
                  name="owner"
                  required
                  placeholder="Responsible owner"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <input
                name="expiry"
                type="date"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Add requirement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
