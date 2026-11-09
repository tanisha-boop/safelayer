import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  Search,
  WalletCards,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";

const statusStyles = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800",
};

const statusLabels = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeActivities(result) {
  const data = result?.data || result?.activities || result;

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

export default function FieldOperations({
  navigationTarget,
  setNavigationTarget,
}) {
  const [activities, setActivities] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [paymentCollection, setPaymentCollection] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const [activityResult, collectionResult] = await Promise.all([
        api.getActivities(),
        api.getCollections(),
      ]);

      setActivities(normalizeActivities(activityResult));

      const collectionData =
        collectionResult?.data ||
        collectionResult?.collections ||
        collectionResult ||
        [];

      setCollections(Array.isArray(collectionData) ? collectionData : []);
    } catch (err) {
      setError(err.message || "Unable to load field operations.");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => {
    loadActivities();
  }, 0);

  return () => clearTimeout(timer);
}, []);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const status = activity.status || "";

      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;

      const searchable = [
        activity.title,
        activity.activityType,
        activity.description,
        activity.assignedToName,
        activity.assigned_to_name,
        activity.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [activities, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: activities.length,
      pending: activities.filter((item) => item.status === "PENDING").length,
      inProgress: activities.filter((item) => item.status === "IN_PROGRESS").length,
      completed: activities.filter((item) => item.status === "COMPLETED").length,
    };
  }, [activities]);

  useEffect(() => {
    if (
      navigationTarget?.entityType !== "FIELD_ACTIVITY" ||
      !navigationTarget?.entityId
    ) {
      return;
    }

    const targetId = String(navigationTarget.entityId);

    const timer = setTimeout(() => {
      setSelectedActivityId(targetId);

      setTimeout(() => {
        document
          .getElementById(`field-activity-${targetId}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 50);

      setNavigationTarget?.(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [navigationTarget, setNavigationTarget]);

  function getCollectionForActivity(activityId) {
    return collections.find(
      (collection) => Number(collection.activity_id) === Number(activityId)
    );
  }

  function openPaymentModal(collection) {
    setError("");
    setPaymentCollection(collection);
    setPaymentAmount(
      Number(collection.collected_amount || 0) > 0
        ? String(collection.collected_amount)
        : ""
    );
    setPaymentNotes(collection.notes || "");
  }

  function closePaymentModal() {
    if (paymentSaving) return;

    setPaymentCollection(null);
    setPaymentAmount("");
    setPaymentNotes("");
  }

  async function handleRecordPayment(event) {
    event.preventDefault();

    if (!paymentCollection?.id) {
      return;
    }

    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid collected amount.");
      return;
    }

    setPaymentSaving(true);
    setError("");

    try {
      await api.collectPayment(paymentCollection.id, {
        collectedAmount: amount,
        notes: paymentNotes.trim() || undefined,
      });

      closePaymentModal();
      await loadActivities();
    } catch (err) {
      setError(err.message || "Unable to record payment.");
    } finally {
      setPaymentSaving(false);
    }
  }

  async function runAction(id, action) {
    setActionId(id);
    setError("");

    try {
      if (action === "start") {
        await api.startActivity(id);
      }

      if (action === "complete") {
        await api.completeActivity(id);
      }

      if (action === "cancel") {
        await api.cancelActivity(id);
      }

      await loadActivities();
    } catch (err) {
      setError(err.message || "Unable to update activity.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">OPERATIONS</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Field Operations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Manage real field activities from the SafeLayer backend.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 dark:bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          New activity
        </button>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Activity} label="Total" value={summary.total} />
        <SummaryCard icon={Clock3} label="Pending" value={summary.pending} />
        <SummaryCard icon={MapPin} label="In progress" value={summary.inProgress} />
        <SummaryCard icon={CheckCircle2} label="Completed" value={summary.completed} />
      </div>

      <div className="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 dark:border-slate-600 focus:bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${
                    statusFilter === status
                      ? "bg-slate-950 text-white dark:bg-slate-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 dark:bg-slate-700"
                  }`}
                >
                  {status === "ALL" ? "All" : statusLabels[status]}
                </button>
              )
            )}
          </div>
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading activities...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-10 text-center">
            <Activity className="mx-auto text-slate-300 dark:text-slate-400" size={32} />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              No activities found
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Try another search or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-5 py-4 font-semibold">Activity</th>
                  <th className="px-5 py-4 font-semibold">Type</th>
                  <th className="px-5 py-4 font-semibold">Assigned</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Scheduled</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredActivities.map((activity) => {
                  const activityType =
                    activity.activityType || activity.activity_type || "";

                  const collection =
                    activityType === "COLLECTION"
                      ? getCollectionForActivity(activity.id)
                      : null;

                  const assigned =
                    activity.assignedToName ||
                    activity.assigned_to_name ||
                    activity.assignedTo ||
                    activity.assigned_to ||
                    "Unassigned";

                  return (
                    <tr
                      id={`field-activity-${activity.id}`}
                      key={activity.id}
                      className={`border-b border-slate-50 dark:border-slate-800 last:border-0 transition ${
                        String(selectedActivityId) === String(activity.id)
                          ? "bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900"
                          : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {activity.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          #{activity.id}
                        </p>

                        {collection && (
                          <div className="mt-2 space-y-1 text-xs">
                            <p className="font-medium text-slate-600 dark:text-slate-400">
                              {collection.reference_number}
                            </p>
                            <p className="text-slate-400 dark:text-slate-500">
                              Expected ₱{Number(collection.expected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="mx-1">·</span>
                              Collected ₱{Number(collection.collected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {activity.activityType || activity.activity_type || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {assigned}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[activity.status] ||
                            "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          {statusLabels[activity.status] || activity.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {formatDate(activity.scheduledAt || activity.scheduled_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {activity.status === "PENDING" && (
                            <ActionButton
                              label="Start"
                              disabled={actionId === activity.id}
                              onClick={() => runAction(activity.id, "start")}
                            />
                          )}

                          {activity.status === "IN_PROGRESS" && (
                            <ActionButton
                              label="Complete"
                              disabled={actionId === activity.id}
                              onClick={() => runAction(activity.id, "complete")}
                            />
                          )}

                          {collection &&
                            collection.collection_status !== "RECONCILED" &&
                            collection.collection_status !== "CANCELLED" &&
                            !collection.remittance_id && (
                              <button
                                type="button"
                                onClick={() => openPaymentModal(collection)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800"
                              >
                                <WalletCards size={14} />
                                Record payment
                              </button>
                            )}

                          {(activity.status === "PENDING" ||
                            activity.status === "IN_PROGRESS") && (
                            <button
                              disabled={actionId === activity.id}
                              onClick={() => runAction(activity.id, "cancel")}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paymentCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                  Record payment
                </h2>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {paymentCollection.reference_number}
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentSaving}
                className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-50"
                aria-label="Close"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="space-y-4 p-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Expected amount</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ₱{Number(paymentCollection.expected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Previously collected</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ₱{Number(paymentCollection.collected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Collected amount
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="5000.00"
                      required
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Enter the actual amount received from the customer.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Notes
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Optional payment notes or field observations..."
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  disabled={paymentSaving}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="rounded-xl bg-slate-950 px-4 dark:bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {paymentSaving ? "Saving..." : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateActivityModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await loadActivities();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg bg-slate-950 px-2 dark:bg-slate-800.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {disabled ? "..." : label}
    </button>
  );
}

function CreateActivityModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    assignedTo: "1",
    activityType: "VISIT",
    title: "",
    description: "",
    scheduledAt: "",
    referenceNumber: "",
    expectedAmount: "",
  });

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true);

      try {
        const result = await api.getUsers();
        const data = result?.data || result?.users || result || [];

        const activeUsers = Array.isArray(data)
          ? data.filter((user) => Number(user.is_active) === 1)
          : [];

        setUsers(activeUsers);

        if (activeUsers.length > 0) {
          setForm((current) => ({
            ...current,
            assignedTo: String(activeUsers[0].id),
          }));
        }
      } catch (err) {
        setError(err.message || "Unable to load users.");
      } finally {
        setUsersLoading(false);
      }
    }

    loadUsers();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const activityResult = await api.createActivity({
        assignedTo: Number(form.assignedTo),
        activityType: form.activityType,
        title: form.title,
        description: form.description || undefined,
        scheduledAt: form.scheduledAt || undefined,
      });

      const activity = activityResult?.data || activityResult;

      if (form.activityType === "COLLECTION") {
        if (!activity?.id) {
          throw new Error(
            "The collection activity was created, but its ID could not be determined."
          );
        }

        await api.createCollection({
          activityId: Number(activity.id),
          collectorId: Number(form.assignedTo),
          referenceNumber: form.referenceNumber.trim(),
          expectedAmount: Number(form.expectedAmount),
          notes: form.description || undefined,
        });
      }

      await onCreated();
    } catch (err) {
      setError(err.message || "Unable to create activity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              New field activity
            </h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Create a real activity in the SafeLayer database.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-50"
            aria-label="Close"
          >
            <XCircle size={20} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Assigned user
              </label>

              <select
                value={form.assignedTo}
                onChange={(event) =>
                  update("assignedTo", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600 disabled:bg-slate-50 dark:disabled:bg-slate-800 dark:bg-slate-800"
                disabled={usersLoading || users.length === 0}
                required
              >
                {usersLoading ? (
                  <option value="">Loading users...</option>
                ) : users.length === 0 ? (
                  <option value="">No active users available</option>
                ) : (
                  users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} — {user.role}
                    </option>
                  ))
                )}
              </select>

              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Only active users in your SafeLayer organization are available.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Activity type
              </label>

              <select
                value={form.activityType}
                onChange={(event) =>
                  update("activityType", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
              >
                <option value="VISIT">Visit</option>
                <option value="COLLECTION">Collection</option>
                <option value="DELIVERY">Delivery</option>
                <option value="INSPECTION">Inspection</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="WASTE_PICKUP">Waste Pickup</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {form.activityType === "COLLECTION" && (
              <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Collection details
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    These details create the collection record that will later
                    be used for payment recording and cash reconciliation.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Collection reference
                  </label>

                  <input
                    value={form.referenceNumber}
                    onChange={(event) =>
                      update("referenceNumber", event.target.value)
                    }
                    placeholder="e.g. COLL-2026-0001"
                    minLength={3}
                    maxLength={100}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                  />

                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Unique reference for this collection.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Expected amount
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">
                      ₱
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.expectedAmount}
                      onChange={(event) =>
                        update("expectedAmount", event.target.value)
                      }
                      placeholder="5000.00"
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Amount the field employee is expected to collect.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Title
              </label>

              <input
                value={form.title}
                onChange={(event) =>
                  update("title", event.target.value)
                }
                placeholder="e.g. Site inspection"
                minLength={3}
                maxLength={200}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Description
              </label>

              <textarea
                value={form.description}
                onChange={(event) =>
                  update("description", event.target.value)
                }
                rows={3}
                placeholder="Describe the field task..."
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Scheduled date and time
              </label>

              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) =>
                  update("scheduledAt", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || usersLoading}
              className="rounded-xl bg-slate-950 px-4 dark:bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
