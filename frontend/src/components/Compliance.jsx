import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";

const statusClasses = {
  ACTIVE:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  EXPIRING_SOON:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  EXPIRED:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  PENDING:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const statusLabels = {
  ACTIVE: "Active",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
  PENDING: "Pending verification",
};

const requirementTypes = [
  "Permit",
  "License",
  "Certification",
  "Insurance",
  "Registration",
  "Contract",
  "Other",
];

function formatDate(value) {
  if (!value) {
    return "No expiry date";
  }

  const date = new Date(`${value}`.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function daysUntil(value) {
  if (!value) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.ceil((date - today) / 86400000);
}

function getResponsibleName(requirement) {
  if (!requirement?.responsibleUser) {
    return "Unassigned";
  }

  return [
    requirement.responsibleUser.firstName,
    requirement.responsibleUser.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function canManageRequirements(user) {
  return ["OWNER", "ADMIN", "MANAGER"].includes(user?.role);
}

function canVerifyEvidence(user) {
  return ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(user?.role);
}

function canUploadEvidence(user) {
  return ["OWNER", "ADMIN", "MANAGER"].includes(user?.role);
}

export default function Compliance({ user }) {
  const [requirements, setRequirements] = useState([]);
  const [users, setUsers] = useState([]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [editingRequirement, setEditingRequirement] = useState(false);
  const [updatingRequirement, setUpdatingRequirement] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationError, setVerificationError] = useState("");

useEffect(() => {
  let cancelled = false;

  async function load() {
    try {
      const result = await api.getUsers();

      if (!cancelled) {
        const activeUsers = (result?.data || [])
          .filter((person) => person.is_active !== 0 && person.isActive !== false)
          .map((person) => ({
            ...person,
            firstName: person.firstName ?? person.first_name ?? "",
            lastName: person.lastName ?? person.last_name ?? "",
            isActive: person.isActive ?? Boolean(person.is_active),
          }));

        setUsers(activeUsers);
      }
    } catch {
      if (!cancelled) {
        setUsers([]);
      }
    }
  }

  load();

  return () => {
    cancelled = true;
  };
}, []);

  const fetchRequirements = useCallback(async () => {
    const result = await api.getComplianceRequirements({
      search: query,
      status: filter === "All" ? "" : filter,
    });

    return result?.data || [];
  }, [query, filter]);

  async function loadRequirements() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchRequirements();
      setRequirements(data);
    } catch (err) {
      setRequirements([]);
      setError(
        err.message || "Unable to load compliance requirements."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchRequirements();

        if (!cancelled) {
          setRequirements(data);
        }
      } catch (err) {
        if (!cancelled) {
          setRequirements([]);
          setError(
            err.message ||
              "Unable to load compliance requirements."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchRequirements]);

  const counts = useMemo(() => {
    return {
      total: requirements.length,
      active: requirements.filter(
        (item) => item.status === "ACTIVE"
      ).length,
      expiring: requirements.filter(
        (item) => item.status === "EXPIRING_SOON"
      ).length,
      overdue: requirements.filter(
        (item) => item.status === "EXPIRED"
      ).length,
    };
  }, [requirements]);

  const evidenceTotal = useMemo(
    () =>
      requirements.reduce(
        (sum, item) => sum + Number(item.evidenceCount || 0),
        0
      ),
    [requirements]
  );

  const needsAction = counts.expiring + counts.overdue;

  async function openRequirement(requirement) {
    setSelectedRequirement(requirement);
    setSelectedEvidence([]);
    setDetailError("");
    setUploadError("");
    setVerificationError("");
    setEditingRequirement(false);
    setUpdateError("");
    setLoadingEvidence(true);

    try {
      const [requirementResult, evidenceResult] =
        await Promise.all([
          api.getComplianceRequirement(requirement.id),
          api.getComplianceEvidence(requirement.id),
        ]);

      setSelectedRequirement(
        requirementResult?.data || requirement
      );

      setSelectedEvidence(evidenceResult?.data || []);
    } catch (err) {
      setDetailError(
        err.message || "Unable to load requirement details."
      );
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");

    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") || "").trim();
    const requirementType = String(
      form.get("requirementType") || ""
    ).trim();
    const description = String(
      form.get("description") || ""
    ).trim();
    const responsibleUserId =
      form.get("responsibleUserId") || "";
    const expiryDate = String(
      form.get("expiryDate") || ""
    ).trim();

    const payload = {
      name,
      requirementType,
    };

    if (description) {
      payload.description = description;
    }

    if (responsibleUserId) {
      payload.responsibleUserId = Number(responsibleUserId);
    }

    if (expiryDate) {
      payload.expiryDate = expiryDate;
    }

    try {
      await api.createComplianceRequirement(payload);

      setShowAdd(false);
      event.currentTarget.reset();

      await loadRequirements();
    } catch (err) {
      setCreateError(
        err.message || "Unable to create requirement."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();

    if (!selectedRequirement) {
      return;
    }

    setUpdatingRequirement(true);
    setUpdateError("");

    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") || "").trim();
    const requirementType = String(
      form.get("requirementType") || ""
    ).trim();
    const description = String(
      form.get("description") || ""
    ).trim();
    const responsibleUserId =
      form.get("responsibleUserId") || "";
    const expiryDate = String(
      form.get("expiryDate") || ""
    ).trim();

    const payload = {
      name,
      requirementType,
      description,
      responsibleUserId: responsibleUserId
        ? Number(responsibleUserId)
        : null,
      expiryDate: expiryDate || null,
    };

    try {
      await api.updateComplianceRequirement(
        selectedRequirement.id,
        payload
      );

      setEditingRequirement(false);
      setUpdateError("");

      await openRequirement(selectedRequirement);
      await loadRequirements();
    } catch (err) {
      setUpdateError(
        err.message || "Unable to update requirement."
      );
    } finally {
      setUpdatingRequirement(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedRequirement) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const file = form.get("evidence");

    if (!(file instanceof File) || !file.name) {
      setUploadError("Select a PDF or supported image file.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      await api.uploadComplianceEvidence(
        selectedRequirement.id,
        file,
        {
          documentDate:
            form.get("documentDate") || "",
          expiryDate:
            form.get("expiryDate") || "",
        }
      );

      event.currentTarget.reset();

      await openRequirement(selectedRequirement);
      await loadRequirements();
    } catch (err) {
      setUploadError(
        err.message || "Unable to upload evidence."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify(
    evidence,
    verificationStatus
  ) {
    setVerifyingId(evidence.id);
    setVerificationError("");

    try {
      await api.verifyComplianceEvidence(
        evidence.id,
        verificationStatus,
        verificationStatus === "REJECTED"
          ? "Evidence requires replacement or correction."
          : ""
      );

      await openRequirement(selectedRequirement);
      await loadRequirements();
    } catch (err) {
      setVerificationError(
        err.message || "Unable to update evidence verification."
      );
    } finally {
      setVerifyingId(null);
    }
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
            Monitor permits, licenses, certifications, insurance,
            evidence, and renewal readiness from one operational
            control surface.
          </p>
        </div>

        {canManageRequirements(user) && (
          <button
            onClick={() => {
              setCreateError("");
              setShowAdd(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Plus size={17} />
            Add requirement
          </button>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Total requirements",
            counts.total,
            ClipboardCheck,
            "text-slate-600 dark:text-slate-300",
          ],
          [
            "Compliant",
            counts.active,
            CheckCircle2,
            "text-emerald-600 dark:text-emerald-400",
          ],
          [
            "Expiring soon",
            counts.expiring,
            CalendarClock,
            "text-amber-600 dark:text-amber-400",
          ],
          [
            "Overdue",
            counts.overdue,
            XCircle,
            "text-red-600 dark:text-red-400",
          ],
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
              {loading ? "—" : value}
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
                A centralized register of operational requirements
                and supporting evidence.
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
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search requirements..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="All">All</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRING_SOON">
                  Expiring soon
                </option>
                <option value="EXPIRED">Expired</option>
                <option value="PENDING">
                  Pending verification
                </option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading compliance requirements...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <tr>
                    {[
                      "Requirement",
                      "Type",
                      "Responsible",
                      "Expiry",
                      "Status",
                      "Evidence",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {requirements.map((item) => {
                    const days = daysUntil(item.expiryDate);

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
                            Requirement #
                            {String(item.id).padStart(4, "0")}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {item.requirementType}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {getResponsibleName(item)}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {formatDate(item.expiryDate)}
                          </p>

                          {days !== null && (
                            <p
                              className={`mt-1 text-xs ${
                                days < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {days < 0
                                ? `${Math.abs(days)} days overdue`
                                : `${days} days remaining`}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              statusClasses[item.status]
                            }`}
                          >
                            {statusLabels[item.status] ||
                              item.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <FileCheck2 size={16} />
                            {Number(item.evidenceCount || 0)}{" "}
                            {Number(item.evidenceCount || 0) === 1
                              ? "file"
                              : "files"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() =>
                              openRequirement(item)
                            }
                            className="text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {requirements.length === 0 && (
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
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <CalendarClock
              className="text-amber-600 dark:text-amber-400"
              size={20}
            />

            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Upcoming expirations
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Requirements that need attention before they become
                operational blockers.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {requirements
              .filter(
                (item) =>
                  item.status === "EXPIRING_SOON" ||
                  item.status === "PENDING"
              )
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
                      {formatDate(item.expiryDate)} ·{" "}
                      {getResponsibleName(item)}
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Attention
                  </span>
                </div>
              ))}

            {requirements.filter(
              (item) =>
                item.status === "EXPIRING_SOON" ||
                item.status === "PENDING"
            ).length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No upcoming compliance actions.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <ShieldCheck
              className="text-emerald-600 dark:text-emerald-400"
              size={20}
            />

            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">
                Compliance readiness
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Evidence-backed requirements are easier to verify
                and audit.
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
                  width: `${
                    counts.total
                      ? (counts.active / counts.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evidence attached
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {evidenceTotal}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Needs action
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {needsAction}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  Add compliance requirement
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create a requirement for your operational
                  register.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {createError}
              </div>
            )}

            <div className="mt-6 grid gap-4">
              <input
                name="name"
                required
                placeholder="Requirement name"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  name="requirementType"
                  required
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {requirementTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <select
                  name="responsibleUserId"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {users.map((person) => (
                    <option
                      key={person.id}
                      value={person.id}
                    >
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                name="description"
                rows="3"
                placeholder="Description or compliance context"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <input
                name="expiryDate"
                type="date"
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
                disabled={creating}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {creating ? "Creating..." : "Add requirement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedRequirement && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto mt-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 p-6 dark:border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                    {selectedRequirement.name}
                  </h2>

                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      statusClasses[
                        selectedRequirement.status
                      ]
                    }`}
                  >
                    {statusLabels[
                      selectedRequirement.status
                    ] || selectedRequirement.status}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedRequirement.requirementType} ·
                  Requirement #
                  {String(selectedRequirement.id).padStart(
                    4,
                    "0"
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canManageRequirements(user) && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateError("");
                      setEditingRequirement(true);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit requirement
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRequirement(null)
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.3fr]">
              <div className="space-y-5">
                {editingRequirement ? (
                  <form
                    onSubmit={handleUpdate}
                    className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        Edit requirement
                      </h3>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Update the requirement details and renewal information.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500">
                        Requirement name
                      </label>

                      <input
                        name="name"
                        required
                        defaultValue={selectedRequirement.name || ""}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Type
                        </label>

                        <select
                          name="requirementType"
                          required
                          defaultValue={
                            selectedRequirement.requirementType || "Other"
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {requirementTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Responsible user
                        </label>

                        <select
                          name="responsibleUserId"
                          defaultValue={
                            selectedRequirement.responsibleUserId ??
                            selectedRequirement.responsible_user_id ??
                            ""
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">
                            Unassigned
                          </option>

                          {users.map((person) => (
                            <option
                              key={person.id}
                              value={person.id}
                            >
                              {person.firstName} {person.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500">
                        Description
                      </label>

                      <textarea
                        name="description"
                        rows="4"
                        defaultValue={
                          selectedRequirement.description || ""
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500">
                        Requirement expiry
                      </label>

                      <input
                        name="expiryDate"
                        type="date"
                        defaultValue={
                          selectedRequirement.expiryDate || ""
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    {updateError && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {updateError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRequirement(false);
                          setUpdateError("");
                        }}
                        disabled={updatingRequirement}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={updatingRequirement}
                        className="flex-1 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700"
                      >
                        {updatingRequirement
                          ? "Saving..."
                          : "Save changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Responsible user
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {getResponsibleName(
                          selectedRequirement
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Expiry
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {formatDate(
                          selectedRequirement.expiryDate
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Description
                      </p>

                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {selectedRequirement.description ||
                          "No description provided."}
                      </p>
                    </div>
                  </>
                )}

                {canUploadEvidence(user) && (
                  <form
                    onSubmit={handleUpload}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <Upload
                        size={17}
                        className="text-slate-500"
                      />

                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        Attach evidence
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      PDF, JPEG, PNG, or WEBP. Maximum 10 MB.
                    </p>

                    <input
                      name="evidence"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="mt-4 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white dark:text-slate-300 dark:file:bg-slate-700"
                    />

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Document date
                        </label>

                        <input
                          name="documentDate"
                          type="date"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Evidence expiry
                        </label>

                        <input
                          name="expiryDate"
                          type="date"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {uploadError && (
                      <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                        {uploadError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={uploading}
                      className="mt-4 w-full rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700"
                    >
                      {uploading
                        ? "Uploading..."
                        : "Upload evidence"}
                    </button>
                  </form>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950 dark:text-white">
                      Evidence
                    </h3>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Documents attached to this requirement.
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    {selectedEvidence.length}{" "}
                    {selectedEvidence.length === 1
                      ? "file"
                      : "files"}
                  </span>
                </div>

                {detailError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {detailError}
                  </div>
                )}

                {verificationError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {verificationError}
                  </div>
                )}

                {loadingEvidence ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Loading evidence...
                  </div>
                ) : selectedEvidence.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                    <FileCheck2 className="mx-auto text-slate-300 dark:text-slate-600" />

                    <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      No evidence attached
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Upload supporting documentation to begin
                      verification.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {selectedEvidence.map((evidence) => (
                      <div
                        key={evidence.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FileCheck2
                                size={17}
                                className="shrink-0 text-slate-500"
                              />

                              <a
                                href={api.getComplianceEvidenceFileUrl(
                                  evidence.id
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {evidence.fileName}
                              </a>
                            </div>

                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              Uploaded by{" "}
                              {evidence.uploader
                                ? `${evidence.uploader.firstName} ${evidence.uploader.lastName}`
                                : "Unknown user"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {formatDate(
                                evidence.createdAt
                              )}
                              {evidence.documentDate
                                ? ` · Document date ${formatDate(
                                    evidence.documentDate
                                  )}`
                                : ""}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              evidence.verificationStatus ===
                              "VERIFIED"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : evidence.verificationStatus ===
                                  "REJECTED"
                                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {evidence.verificationStatus}
                          </span>
                        </div>

                        {evidence.verificationNotes && (
                          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {evidence.verificationNotes}
                          </p>
                        )}

                        {canVerifyEvidence(user) &&
                          evidence.verificationStatus ===
                            "PENDING" && (
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() =>
                                  handleVerify(
                                    evidence,
                                    "VERIFIED"
                                  )
                                }
                                disabled={
                                  verifyingId === evidence.id
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                <CheckCircle2 size={15} />
                                {verifyingId === evidence.id
                                  ? "Updating..."
                                  : "Verify"}
                              </button>

                              <button
                                onClick={() =>
                                  handleVerify(
                                    evidence,
                                    "REJECTED"
                                  )
                                }
                                disabled={
                                  verifyingId === evidence.id
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                <XCircle size={15} />
                                Reject
                              </button>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
