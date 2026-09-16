import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";

const STATUS_OPTIONS = [
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "ESCALATED",
  "RESOLVED",
];

const PRIORITY_OPTIONS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const ENTITY_OPTIONS = [
  "ACTIVITY",
  "INVOICE",
  "TRANSACTION",
];

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

function getEntityTitle(review) {
  if (!review?.entity) return "Unknown entity";

  if (review.entityType === "ACTIVITY") {
    return review.entity.title || `Activity #${review.entity.id}`;
  }

  if (review.entityType === "INVOICE") {
    return (
      review.entity.invoiceNumber ||
      review.entity.vendorName ||
      `Invoice #${review.entity.id}`
    );
  }

  if (review.entityType === "TRANSACTION") {
    return (
      review.entity.reference ||
      `Transaction #${review.entity.id}`
    );
  }

  return `Entity #${review.entity.id}`;
}

function getEntityDescription(review) {
  if (!review?.entity) return "";

  if (review.entityType === "ACTIVITY") {
    return [
      review.entity.type,
      review.entity.status,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (review.entityType === "INVOICE") {
    return [
      review.entity.vendorName,
      review.entity.amount != null
        ? `₱${Number(review.entity.amount).toLocaleString()}`
        : null,
      review.entity.status,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (review.entityType === "TRANSACTION") {
    return [
      review.entity.type,
      review.entity.amount != null
        ? `₱${Number(review.entity.amount).toLocaleString()}`
        : null,
      review.entity.status,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

function priorityClasses(priority) {
  switch (priority) {
    case "CRITICAL":
      return "bg-red-100 text-red-700";
    case "HIGH":
      return "bg-orange-100 text-orange-700";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
  }
}

function statusClasses(status) {
  switch (status) {
    case "OPEN":
      return "bg-blue-100 text-blue-700";
    case "IN_REVIEW":
      return "bg-violet-100 text-violet-700";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "ESCALATED":
      return "bg-orange-100 text-orange-700";
    case "RESOLVED":
      return "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
  }
}

function PriorityIcon({ priority }) {
  if (priority === "CRITICAL" || priority === "HIGH") {
    return <ShieldAlert size={16} />;
  }

  return <AlertTriangle size={16} />;
}

export default function Reviews({ user }) {
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);

  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [entityType, setEntityType] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [assignedTo, setAssignedTo] = useState("");
  const [resolution, setResolution] = useState("");

  const role = useMemo(
    () =>
      user?.roles?.[0]?.name ||
      user?.role ||
      "",
    [user]
  );

  const canResolve =
    ["OWNER", "ADMIN", "MANAGER"].includes(role);

  async function loadReviews() {
    try {
      setLoading(true);
      setError("");

      const result = await api.getReviews({
        status,
        priority,
        entityType,
        page: 1,
        limit: 50,
      });

      setReviews(result?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  async function openReview(id) {
    try {
      setDetailLoading(true);
      setError("");
      setMessage("");

      const result = await api.getReview(id);
      const review = result?.data || result;

      setSelectedReview(review);
      setAssignedTo(review?.assignedTo?.id || "");
      setResolution(review?.resolution || "");
    } catch (err) {
      setError(err.message || "Failed to load review.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, [status, priority, entityType]);

  async function updateSelected(changes) {
    if (!selectedReview) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const result = await api.updateReview(
        selectedReview.id,
        changes
      );

      const updated = result?.data || result;

      setSelectedReview(updated);
      setAssignedTo(updated?.assignedTo?.id || "");
      setResolution(updated?.resolution || "");

      setMessage("Review updated successfully.");
      await loadReviews();
    } catch (err) {
      setError(err.message || "Failed to update review.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    await updateSelected({
      assignedTo: assignedTo
        ? Number(assignedTo)
        : null,
    });
  }

  async function handleStatusChange(nextStatus) {
    const changes = {
      status: nextStatus,
    };

    if (resolution.trim()) {
      changes.resolution = resolution.trim();
    }

    await updateSelected(changes);
  }

  const activeCount = reviews.filter((review) =>
    ["OPEN", "IN_REVIEW"].includes(review.status)
  ).length;

  const highRiskCount = reviews.filter((review) =>
    ["HIGH", "CRITICAL"].includes(review.priority)
  ).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-800">
              <UserCheck size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Reviews
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Human review queue for flagged operational activity.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadReviews}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Active reviews
            </span>

            <Clock3 size={18} className="text-slate-400 dark:text-slate-500" />
          </div>

          <div className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
            {activeCount}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              High / critical
            </span>

            <ShieldAlert size={18} className="text-slate-400 dark:text-slate-500" />
          </div>

          <div className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
            {highRiskCount}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400 dark:border-slate-600"
          >
            <option value="">All statuses</option>

            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400 dark:border-slate-600"
          >
            <option value="">All priorities</option>

            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={entityType}
            onChange={(event) =>
              setEntityType(event.target.value)
            }
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400 dark:border-slate-600"
          >
            <option value="">All entity types</option>

            {ENTITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16">
              <Loader2
                size={24}
                className="animate-spin text-slate-500 dark:text-slate-400"
              />
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-16 text-center">
              <CheckCircle2
                size={30}
                className="mx-auto text-slate-300 dark:text-slate-400"
              />

              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                No reviews found
              </p>

              <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                Try changing the filters.
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <button
                key={review.id}
                onClick={() => openReview(review.id)}
                className={`w-full rounded-2xl border bg-white dark:bg-slate-900 p-5 text-left shadow-sm transition hover:border-slate-300 dark:border-slate-700 hover:shadow ${
                  selectedReview?.id === review.id
                    ? "border-slate-400 dark:border-slate-600 ring-1 ring-slate-300"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                        REVIEW #{review.id}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityClasses(
                          review.priority
                        )}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <PriorityIcon
                            priority={review.priority}
                          />
                          {review.priority}
                        </span>
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                          review.status
                        )}`}
                      >
                        {review.status.replace("_", " ")}
                      </span>
                    </div>

                    <h2 className="mt-3 truncate text-base font-bold text-slate-900 dark:text-slate-100">
                      {getEntityTitle(review)}
                    </h2>

                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {review.entityType}
                    </p>

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {review.reason}
                    </p>
                  </div>

                  <ChevronRight
                    size={19}
                    className="mt-1 shrink-0 text-slate-300 dark:text-slate-400"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-400 dark:text-slate-500">
                  <span>
                    Created {formatDate(review.createdAt)}
                  </span>

                  <span>
                    {review.assignedTo
                      ? `Assigned to ${review.assignedTo.firstName} ${review.assignedTo.lastName}`
                      : "Unassigned"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                size={24}
                className="animate-spin text-slate-500 dark:text-slate-400"
              />
            </div>
          ) : !selectedReview ? (
            <div className="px-6 py-20 text-center">
              <FileText
                size={30}
                className="mx-auto text-slate-300 dark:text-slate-400"
              />

              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Select a review
              </p>

              <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                Review details and available actions will appear here.
              </p>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Review #{selectedReview.id}
                  </p>

                  <h2 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                    {getEntityTitle(selectedReview)}
                  </h2>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                    selectedReview.status
                  )}`}
                >
                  {selectedReview.status.replace("_", " ")}
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Reason
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {selectedReview.reason}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Entity
                  </div>

                  <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {selectedReview.entityType}
                    </div>

                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {getEntityDescription(selectedReview)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Assigned reviewer
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input
                      value={assignedTo}
                      onChange={(event) =>
                        setAssignedTo(event.target.value)
                      }
                      placeholder="User ID"
                      type="number"
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                    />

                    {canResolve && (
                      <button
                        onClick={handleAssign}
                        disabled={saving}
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        Assign
                      </button>
                    )}
                  </div>

                  {selectedReview.assignedTo && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      Current:{" "}
                      {selectedReview.assignedTo.firstName}{" "}
                      {selectedReview.assignedTo.lastName}{" "}
                      · {selectedReview.assignedTo.email}
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Resolution
                  </div>

                  <textarea
                    value={resolution}
                    onChange={(event) =>
                      setResolution(event.target.value)
                    }
                    rows={5}
                    maxLength={2000}
                    placeholder="Document the review decision or findings..."
                    disabled={!canResolve}
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm leading-6 outline-none focus:border-slate-400 dark:border-slate-600 disabled:bg-slate-50 dark:disabled:bg-slate-800 dark:bg-slate-800"
                  />
                </div>
              </div>

              {canResolve &&
                ["OPEN", "IN_REVIEW"].includes(
                  selectedReview.status
                ) && (
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {selectedReview.status === "OPEN" && (
                      <button
                        onClick={() =>
                          handleStatusChange("IN_REVIEW")
                        }
                        disabled={saving}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800 disabled:opacity-50"
                      >
                        Start Review
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handleStatusChange("APPROVED")
                      }
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange("REJECTED")
                      }
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange("ESCALATED")
                      }
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      <ShieldAlert size={14} />
                      Escalate
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange("RESOLVED")
                      }
                      disabled={saving}
                      className="col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                )}

              {saving && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                  Saving review...
                </div>
              )}

              <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-400 dark:text-slate-500">
                Created {formatDate(selectedReview.createdAt)}

                {selectedReview.resolvedAt && (
                  <>
                    <br />
                    Resolved{" "}
                    {formatDate(selectedReview.resolvedAt)}
                  </>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
