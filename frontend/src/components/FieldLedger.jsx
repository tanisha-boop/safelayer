import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { api } from "../services/api";

const STATUS_OPTIONS = [
  "ALL",
  "EXPECTED",
  "COLLECTED",
  "PARTIAL",
  "DISPUTED",
  "RECONCILED",
  "CANCELLED",
];

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status) {
  switch (status) {
    case "COLLECTED":
    case "RECONCILED":
    case "VERIFIED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "PARTIAL":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "DISPUTED":
    case "INVESTIGATION":
      return "bg-red-50 text-red-700 border-red-200";

    case "EXPECTED":
    case "PENDING":
      return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800";

    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800";
  }
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
        status
      )}`}
    >
      {status}
    </span>
  );
}

function Metric({ label, value, icon: Icon, danger = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              danger ? "text-red-600" : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {money(value)}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            danger
              ? "bg-red-50 text-red-600"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          }`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function FieldLedger({ user }) {
  const [collections, setCollections] = useState([]);
  const [remittances, setRemittances] = useState([]);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);

  const [selectedCollection, setSelectedCollection] = useState(null);
  const [selectedRemittance, setSelectedRemittance] = useState(null);
  const [selectedRemittanceId, setSelectedRemittanceId] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showRemittanceForm, setShowRemittanceForm] = useState(false);

  const [collectionForm, setCollectionForm] = useState({
    activityId: "",
    collectorId: "",
    referenceNumber: "",
    expectedAmount: "",
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    collectedAmount: "",
    notes: "",
  });

  const [remittanceForm, setRemittanceForm] = useState({
    collectorId: "",
    remittanceReference: "",
    declaredAmount: "",
  });

  const [remittanceItemCollectionId, setRemittanceItemCollectionId] =
    useState("");

  const canManageCollections = ["OWNER", "ADMIN", "MANAGER"].includes(
    user?.role
  );

  const canVerifyRemittance = ["OWNER", "ADMIN", "FINANCE"].includes(
    user?.role
  );

  const activeFieldWorkers = useMemo(
    () =>
      users.filter(
        (item) =>
          Number(item.is_active) === 1 &&
          ["FIELD_WORKER", "FIELD_EMPLOYEE"].includes(item.role)
      ),
    [users]
  );

  const collectionActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.activity_type === "COLLECTION" &&
          !["COMPLETED", "CANCELLED"].includes(activity.status)
      ),
    [activities]
  );

  const collectedCollections = useMemo(
    () =>
      collections.filter(
        (collection) =>
          Number(collection.collected_amount) > 0 &&
          !collection.remittance_id &&
          collection.collection_status !== "RECONCILED" &&
          collection.collection_status !== "CANCELLED"
      ),
    [collections]
  );

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        collectionResult,
        activityResult,
        userResult,
        remittanceResult,
      ] = await Promise.all([
        api.getCollections(
          statusFilter === "ALL" ? undefined : statusFilter
        ),
        api.getActivities(),
        api.getUsers(),
        api.getRemittances(),
      ]);

      setCollections(
        Array.isArray(collectionResult?.data)
          ? collectionResult.data
          : Array.isArray(collectionResult)
          ? collectionResult
          : []
      );

      setActivities(
        Array.isArray(activityResult?.data)
          ? activityResult.data
          : Array.isArray(activityResult)
          ? activityResult
          : []
      );

      setRemittances(
        Array.isArray(remittanceResult?.data)
          ? remittanceResult.data
          : Array.isArray(remittanceResult)
          ? remittanceResult
          : []
      );

      const activeUsers = Array.isArray(userResult?.data)
        ? userResult.data
        : Array.isArray(userResult)
        ? userResult
        : [];

      setUsers(activeUsers.filter((item) => Number(item.is_active) === 1));
    } catch (err) {
      setError(err.message || "Unable to load FieldLedger data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedRemittanceId && remittances.length > 0) {
      const firstRemittance = remittances[0];

      setSelectedRemittanceId(String(firstRemittance.id));
      setSelectedRemittance(firstRemittance);
    }
  }, [remittances, selectedRemittanceId]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function handleActivityChange(activityId) {
    const activity = activities.find(
      (item) => Number(item.id) === Number(activityId)
    );

    setCollectionForm((current) => ({
      ...current,
      activityId,
      collectorId: activity?.assigned_to || "",
    }));
  }

  async function handleCreateCollection(event) {
    event.preventDefault();
    clearMessages();
    setSaving(true);

    try {
      await api.createCollection({
        activityId: Number(collectionForm.activityId),
        collectorId: Number(collectionForm.collectorId),
        referenceNumber: collectionForm.referenceNumber.trim(),
        expectedAmount: Number(collectionForm.expectedAmount),
        notes: collectionForm.notes.trim() || undefined,
      });

      setSuccess("Collection record created successfully.");

      setCollectionForm({
        activityId: "",
        collectorId: "",
        referenceNumber: "",
        expectedAmount: "",
        notes: "",
      });

      setShowCollectionForm(false);

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to create collection.");
    } finally {
      setSaving(false);
    }
  }

  async function openCollection(collection) {
    setLoadingDetail(true);
    clearMessages();

    try {
      const result = await api.getCollection(collection.id);
      setSelectedCollection(result?.data || result);
      setPaymentForm({
        collectedAmount: Number(
          result?.data?.collected_amount ??
            result?.collected_amount ??
            0
        ),
        notes: result?.data?.notes || result?.notes || "",
      });
    } catch (err) {
      setError(err.message || "Unable to load collection.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleRecordPayment(event) {
    event.preventDefault();

    if (!selectedCollection) {
      return;
    }

    clearMessages();
    setSaving(true);

    try {
      const result = await api.collectPayment(selectedCollection.id, {
        collectedAmount: Number(paymentForm.collectedAmount),
        notes: paymentForm.notes.trim() || undefined,
      });

      setSelectedCollection(result?.data || result);
      setSuccess("Collection payment recorded.");

      setShowPaymentForm(false);

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRemittance(event) {
    event.preventDefault();
    clearMessages();
    setSaving(true);

    try {
      const result = await api.createRemittance({
        collectorId: Number(remittanceForm.collectorId),
        remittanceReference: remittanceForm.remittanceReference.trim(),
        declaredAmount: Number(remittanceForm.declaredAmount),
      });

      const remittance = result?.data || result;

      setSelectedRemittance(remittance);
      setSelectedRemittanceId(String(remittance.id));

      setSuccess(
        "Remittance created. Add the collected records before verification."
      );

      setRemittanceForm({
        collectorId: "",
        remittanceReference: "",
        declaredAmount: "",
      });

      setShowRemittanceForm(false);
    } catch (err) {
      setError(err.message || "Unable to create remittance.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectRemittance(id) {
    if (!id) {
      setSelectedRemittanceId("");
      setSelectedRemittance(null);
      return;
    }

    clearMessages();
    setLoadingDetail(true);
    setSelectedRemittanceId(String(id));

    try {
      const result = await api.getRemittance(Number(id));
      const data = result?.data || result;

      setSelectedRemittance(
        data?.remittance || data
      );
    } catch (err) {
      setError(
        err.message || "Unable to load remittance."
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshRemittance() {
    if (!selectedRemittance?.id) {
      return;
    }

    try {
      const result = await api.getRemittance(selectedRemittance.id);
      setSelectedRemittance(result?.data?.remittance || result?.remittance || result);
    } catch (err) {
      setError(err.message || "Unable to refresh remittance.");
    }
  }

  async function handleAddRemittanceItem(event) {
    event.preventDefault();

    if (!selectedRemittance?.id || !remittanceItemCollectionId) {
      return;
    }

    const collection = collections.find(
      (item) => Number(item.id) === Number(remittanceItemCollectionId)
    );

    if (!collection) {
      setError("Collection record could not be found.");
      return;
    }

    clearMessages();
    setSaving(true);

    try {
      const result = await api.addRemittanceItem(selectedRemittance.id, {
        collectionId: Number(collection.id),
        amount: Number(collection.collected_amount),
      });

      const responseData = result?.data || result;
      setSelectedRemittance({
        ...(responseData?.remittance || responseData),
        items: responseData?.items || [],
      });
      setRemittanceItemCollectionId("");

      setSuccess("Collection added to remittance.");

      await refreshRemittance();
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to add collection to remittance.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyRemittance() {
    if (!selectedRemittance?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Verify this remittance? A variance will be marked as an investigation."
    );

    if (!confirmed) {
      return;
    }

    clearMessages();
    setSaving(true);

    try {
      const result = await api.verifyRemittance(selectedRemittance.id);

      setSelectedRemittance(result?.data?.remittance || result?.remittance || result);

      setSuccess("Remittance verification completed.");

      await loadData();
      await refreshRemittance();
    } catch (err) {
      setError(err.message || "Unable to verify remittance.");
    } finally {
      setSaving(false);
    }
  }

  const metrics = useMemo(() => {
    return collections.reduce(
      (result, item) => {
        result.expected += Number(item.expected_amount || 0);
        result.collected += Number(item.collected_amount || 0);

        if (item.collection_status === "DISPUTED") {
          result.disputed += Number(item.collected_amount || 0);
        }

        if (
          ["EXPECTED", "PARTIAL", "DISPUTED", "COLLECTED"].includes(
            item.collection_status
          )
        ) {
          result.unreconciled += Number(item.collected_amount || 0);
        }

        return result;
      },
      {
        expected: 0,
        collected: 0,
        disputed: 0,
        unreconciled: 0,
      }
    );
  }, [collections]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-800">
              <WalletCards size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                FieldLedger
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Field collection accountability and cash reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {canManageCollections && (
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setShowCollectionForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={16} />
              New Collection
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              clearMessages();
              setShowRemittanceForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800"
          >
            <Send size={16} />
            New Remittance
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">{success}</div>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Expected"
          value={metrics.expected}
          icon={ClipboardList}
        />

        <Metric
          label="Collected"
          value={metrics.collected}
          icon={CircleDollarSign}
        />

        <Metric
          label="Disputed"
          value={metrics.disputed}
          icon={AlertTriangle}
          danger
        />

        <Metric
          label="Unreconciled"
          value={metrics.unreconciled}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  Collection Records
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Track expected, collected, disputed, and reconciled field
                  payments.
                </p>
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-slate-400 dark:border-slate-600"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "ALL" ? "All statuses" : status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="animate-spin text-slate-500 dark:text-slate-400" size={24} />
            </div>
          ) : collections.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <ClipboardList size={32} className="text-slate-300 dark:text-slate-400" />
              <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">
                No collection records
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create a collection record to begin tracking field payments.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Reference
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Activity
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Collector
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Expected
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Collected
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {collections.map((collection) => (
                    <tr
                      key={collection.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {collection.reference_number}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          #{collection.id}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="max-w-[210px] truncate text-sm text-slate-700 dark:text-slate-200">
                          {collection.activity_title || "Unknown activity"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {collection.first_name} {collection.last_name}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                        {money(collection.expected_amount)}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {money(collection.collected_amount)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={collection.collection_status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openCollection(collection)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white dark:text-slate-100"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 p-5">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Remittance Control
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Build a remittance from collected field transactions and compare
              declared cash against expected cash.
            </p>
          </div>

          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Select Remittance
                </label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Open an existing remittance to review its cash turnover and reconciliation status.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowRemittanceForm(true);
                }}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white"
              >
                <Plus size={15} />
                New Remittance
              </button>
            </div>

            {remittances.length > 0 ? (
              <select
                value={selectedRemittanceId}
                onChange={(event) =>
                  handleSelectRemittance(event.target.value)
                }
                disabled={loadingDetail || saving}
                className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-slate-400 dark:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select a remittance</option>

                {remittances.map((remittance) => (
                  <option
                    key={remittance.id}
                    value={remittance.id}
                  >
                    {remittance.remittance_reference} — {money(remittance.actual_amount)} — {remittance.status}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm text-slate-500 dark:text-slate-400">
                No remittance records found.
              </div>
            )}
          </div>

          {!selectedRemittance ? (
            <div className="p-6">
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5">
                <Send size={24} className="text-slate-400 dark:text-slate-500" />

                <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">
                  No remittance selected
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Select an existing remittance above, or create a new one to begin a cash turnover.
                </p>

              </div>
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Remittance
                  </p>

                  <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {selectedRemittance.remittance_reference}
                  </h3>
                </div>

                <StatusBadge status={selectedRemittance.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Expected</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {money(selectedRemittance.expected_amount)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Declared</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {money(selectedRemittance.actual_amount)}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  Number(selectedRemittance.variance_amount || 0) === 0
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Variance
                </p>

                <p
                  className={`mt-1 text-xl font-bold ${
                    Number(selectedRemittance.variance_amount || 0) === 0
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {money(selectedRemittance.variance_amount)}
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Actual amount minus expected amount
                </p>
              </div>

              <form
                onSubmit={handleAddRemittanceItem}
                className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-5"
              >
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Add collected record
                  </label>

                  <select
                    value={remittanceItemCollectionId}
                    onChange={(event) =>
                      setRemittanceItemCollectionId(event.target.value)
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                    disabled={
                      selectedRemittance.status !== "PENDING" ||
                      saving
                    }
                  >
                    <option value="">Select collection</option>

                    {collectedCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.reference_number} —{" "}
                        {money(collection.collected_amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    selectedRemittance.status !== "PENDING" ||
                    !remittanceItemCollectionId
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add Collection
                </button>
              </form>

              {canVerifyRemittance &&
                ["PENDING", "SUBMITTED"].includes(
                  selectedRemittance.status
                ) && (
                  <button
                    type="button"
                    onClick={handleVerifyRemittance}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    Verify Remittance
                  </button>
                )}

              <button
                type="button"
                onClick={refreshRemittance}
                className="flex w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:text-slate-100"
              >
                <RefreshCw size={15} />
                Refresh Remittance
              </button>
            </div>
          )}
        </section>
      </div>

      {loadingDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/20 dark:bg-slate-950/40 backdrop-blur-sm">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
            <Loader2
              size={25}
              className="animate-spin text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>
      )}

      {selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Collection #{selectedCollection.id}
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedCollection.reference_number}
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedCollection.activity_title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-slate-700 dark:text-slate-200"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Expected</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {money(selectedCollection.expected_amount)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Collected</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {money(selectedCollection.collected_amount)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                  <div className="mt-2">
                    <StatusBadge
                      status={selectedCollection.collection_status}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Collector
                </p>

                <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">
                  {selectedCollection.first_name}{" "}
                  {selectedCollection.last_name}
                </p>

                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedCollection.collector_email}
                </p>
              </div>

              {!["RECONCILED", "CANCELLED"].includes(
                selectedCollection.collection_status
              ) && (
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  <CircleDollarSign size={17} />
                  Record / Update Payment
                </button>
              )}

              {selectedCollection.notes && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Notes
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {selectedCollection.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCollectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 p-4">
          <form
            onSubmit={handleCreateCollection}
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Create Collection
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create the expected cash record before the field payment is
                  recorded.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCollectionForm(false)}
                className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Collection Activity
                </label>

                <select
                  required
                  value={collectionForm.activityId}
                  onChange={(event) =>
                    handleActivityChange(event.target.value)
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                >
                  <option value="">Select collection activity</option>

                  {collectionActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} — {activity.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Assigned Collector
                </label>

                <select
                  required
                  value={collectionForm.collectorId}
                  onChange={(event) =>
                    setCollectionForm((current) => ({
                      ...current,
                      collectorId: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                >
                  <option value="">Select collector</option>

                  {activeFieldWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  The backend will confirm that this collector is assigned to
                  the selected activity.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Reference Number
                </label>

                <input
                  required
                  value={collectionForm.referenceNumber}
                  onChange={(event) =>
                    setCollectionForm((current) => ({
                      ...current,
                      referenceNumber: event.target.value,
                    }))
                  }
                  placeholder="COLL-0007"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Expected Amount
                </label>

                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={collectionForm.expectedAmount}
                  onChange={(event) =>
                    setCollectionForm((current) => ({
                      ...current,
                      expectedAmount: event.target.value,
                    }))
                  }
                  placeholder="5000.00"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Notes
                </label>

                <textarea
                  rows="3"
                  value={collectionForm.notes}
                  onChange={(event) =>
                    setCollectionForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 p-6">
              <button
                type="button"
                onClick={() => setShowCollectionForm(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Create Collection
              </button>
            </div>
          </form>
        </div>
      )}

      {showPaymentForm && selectedCollection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 p-4">
          <form
            onSubmit={handleRecordPayment}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Record Payment
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedCollection.reference_number}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Expected</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {money(selectedCollection.expected_amount)}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Current collected</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {money(selectedCollection.collected_amount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Collected Amount
                </label>

                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={paymentForm.collectedAmount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      collectedAmount: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Amount above expected will create a DISPUTED collection.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Notes
                </label>

                <textarea
                  rows="3"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 p-6">
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Save Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {showRemittanceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 p-4">
          <form
            onSubmit={handleCreateRemittance}
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Create Remittance
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Start a cash turnover record for a field collector.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRemittanceForm(false)}
                className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Collector
                </label>

                <select
                  required
                  value={remittanceForm.collectorId}
                  onChange={(event) =>
                    setRemittanceForm((current) => ({
                      ...current,
                      collectorId: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                >
                  <option value="">Select collector</option>

                  {activeFieldWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Remittance Reference
                </label>

                <input
                  required
                  value={remittanceForm.remittanceReference}
                  onChange={(event) =>
                    setRemittanceForm((current) => ({
                      ...current,
                      remittanceReference: event.target.value,
                    }))
                  }
                  placeholder="REM-0007"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Declared Amount
                </label>

                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={remittanceForm.declaredAmount}
                  onChange={(event) =>
                    setRemittanceForm((current) => ({
                      ...current,
                      declaredAmount: event.target.value,
                    }))
                  }
                  placeholder="4000.00"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                />

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  This is the amount the collector declares as turned over.
                  The system will compare it against linked collections.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 p-6">
              <button
                type="button"
                onClick={() => setShowRemittanceForm(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Create Remittance
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}