import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";

const STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "VERIFIED",
  "REQUIRES_REVIEW",
  "REJECTED",
  "PAID",
];

function statusClass(status) {
  const classes = {
    PENDING: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
    VERIFIED: "bg-emerald-50 text-emerald-700",
    REQUIRES_REVIEW: "bg-amber-50 text-amber-700",
    REJECTED: "bg-red-50 text-red-700",
    PAID: "bg-blue-50 text-blue-700",
  };

  return classes[status] || "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200";
}

function riskClass(level) {
  const classes = {
    LOW: "bg-emerald-50 text-emerald-700",
    MEDIUM: "bg-amber-50 text-amber-700",
    HIGH: "bg-orange-50 text-orange-700",
    CRITICAL: "bg-red-50 text-red-700",
  };

  return classes[level] || "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200";
}

function formatAmount(amount, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InvoiceGuard({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    vendorName: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    amount: "",
    currency: "PHP",
    activityId: "",
  });

  const [reviewResolution, setReviewResolution] = useState("");

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await api.getInvoices(
        statusFilter === "ALL" ? "" : statusFilter,
        vendorFilter.trim()
      );

      setInvoices(result?.data || []);
    } catch (err) {
      setError(err.message || "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vendorFilter]);

  async function loadInvoice(id) {
    setDetailLoading(true);
    setError("");

    try {
      const result = await api.getInvoice(id);
      setSelectedInvoice(result?.data || null);
    } catch (err) {
      setError(err.message || "Unable to load invoice.");
    } finally {
      setDetailLoading(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => {
    loadInvoices();
  }, 0);

  return () => clearTimeout(timer);
}, [loadInvoices]);

  async function handleCreate(event) {
    event.preventDefault();
    setActionLoading(true);
    setError("");

    try {
      const payload = {
        vendorName: form.vendorName.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate || undefined,
        dueDate: form.dueDate || undefined,
        amount: Number(form.amount),
        currency: form.currency.toUpperCase(),
        activityId: form.activityId
          ? Number(form.activityId)
          : undefined,
      };

      const result = await api.createInvoice(payload);

      setForm({
        vendorName: "",
        invoiceNumber: "",
        invoiceDate: "",
        dueDate: "",
        amount: "",
        currency: "PHP",
        activityId: "",
      });

      setShowCreate(false);

      await loadInvoices();

      if (result?.data?.id) {
        await loadInvoice(result.data.id);
      }
    } catch (err) {
      setError(err.message || "Unable to create invoice.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerify() {
    if (!selectedInvoice?.invoice?.id) return;

    setActionLoading(true);
    setError("");

    try {
      const result = await api.verifyInvoice(
        selectedInvoice.invoice.id
      );

      setSelectedInvoice({
        invoice: result?.data?.invoice,
        evidence: selectedInvoice.evidence || [],
        reviews: selectedInvoice.reviews || [],
        assessment: result?.data?.assessment,
      });

      await loadInvoice(selectedInvoice.invoice.id);
      await loadInvoices();
    } catch (err) {
      setError(err.message || "Unable to verify invoice.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReview(decision) {
    if (!selectedInvoice?.invoice?.id) return;

    setActionLoading(true);
    setError("");

    try {
      await api.reviewInvoice(
        selectedInvoice.invoice.id,
        decision,
        reviewResolution.trim()
      );

      setReviewResolution("");

      await loadInvoice(selectedInvoice.invoice.id);
      await loadInvoices();
    } catch (err) {
      setError(err.message || "Unable to review invoice.");
    } finally {
      setActionLoading(false);
    }
  }

  const invoice = selectedInvoice?.invoice;
  const evidence = selectedInvoice?.evidence || [];
  const reviews = selectedInvoice?.reviews || [];
  const assessment = selectedInvoice?.assessment;

  const canCreate =
    user?.role === "OWNER" ||
    user?.role === "MANAGER" ||
    user?.role === "FINANCE";

  const canReview =
    user?.role === "OWNER" ||
    user?.role === "MANAGER" ||
    user?.role === "FINANCE";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            FINANCIAL TRUST
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Invoice Guard
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Verify invoices, detect duplicate patterns, and route risky
            invoices for human review.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-xl bg-slate-950 px-4 dark:bg-slate-800 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Submit Invoice
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Total Invoices"
          value={invoices.length}
          icon={FileText}
        />

        <Metric
          label="Pending Review"
          value={
            invoices.filter(
              (item) => item.status === "REQUIRES_REVIEW"
            ).length
          }
          icon={ShieldAlert}
        />

        <Metric
          label="Verified"
          value={
            invoices.filter(
              (item) => item.status === "VERIFIED"
            ).length
          }
          icon={ShieldCheck}
        />

        <Metric
          label="Rejected"
          value={
            invoices.filter(
              (item) => item.status === "REJECTED"
            ).length
          }
          icon={XCircle}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                    Invoice Queue
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Organization-scoped invoice records
                  </p>
                </div>

                <FileCheck2
                  size={19}
                  className="text-slate-400 dark:text-slate-500"
                />
              </div>

              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={15}
                    className="absolute left-3 top-3 text-slate-400 dark:text-slate-500"
                  />

                  <input
                    value={vendorFilter}
                    onChange={(event) =>
                      setVendorFilter(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        loadInvoices();
                      }
                    }}
                    placeholder="Search vendor"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
                  />
                </div>

                <button
                  onClick={loadInvoices}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800"
                >
                  Search
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      statusFilter === status
                        ? "bg-slate-950 text-white dark:bg-slate-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 dark:bg-slate-700"
                    }`}
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-10 text-sm text-slate-500 dark:text-slate-400">
                <Loader2
                  size={18}
                  className="mr-2 animate-spin"
                />
                Loading invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-10 text-center">
                <FileText
                  size={30}
                  className="mx-auto text-slate-300 dark:text-slate-400"
                />

                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No invoices found
                </p>

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Try another filter or submit a new invoice.
                </p>
              </div>
            ) : (
              invoices.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadInvoice(item.id)}
                  className={`w-full border-b border-slate-100 dark:border-slate-800 p-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800 ${
                    invoice?.id === item.id
                      ? "bg-slate-50 dark:bg-slate-800"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.invoice_number}
                      </p>

                      <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
                        {item.vendor_name}
                      </p>

                      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        Submitted by{" "}
                        {item.first_name} {item.last_name}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatAmount(
                          item.amount,
                          item.currency
                        )}
                      </p>

                      <span
                        className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(
                          item.status
                        )}`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {detailLoading ? (
            <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              <Loader2
                size={20}
                className="mr-2 animate-spin"
              />
              Loading invoice details...
            </div>
          ) : !invoice ? (
            <div className="flex min-h-[500px] flex-col items-center justify-center p-10 text-center">
              <ShieldCheck
                size={42}
                className="text-slate-300 dark:text-slate-400"
              />

              <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
                Select an invoice
              </h2>

              <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Select an invoice from the queue to inspect its evidence,
                risk assessment, and review status.
              </p>
            </div>
          ) : (
            <div>
              <div className="border-b border-slate-100 dark:border-slate-800 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Invoice
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                      {invoice.invoice_number}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {invoice.vendor_name}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(
                      invoice.status
                    )}`}
                  >
                    {invoice.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <Detail
                  label="Amount"
                  value={formatAmount(
                    invoice.amount,
                    invoice.currency
                  )}
                />

                <Detail
                  label="Invoice Date"
                  value={formatDate(invoice.invoice_date)}
                />

                <Detail
                  label="Due Date"
                  value={formatDate(invoice.due_date)}
                />

                <Detail
                  label="Submitted"
                  value={formatDateTime(invoice.created_at)}
                />

                <Detail
                  label="Submitted By"
                  value={`${invoice.first_name || ""} ${
                    invoice.last_name || ""
                  }`}
                />

                <Detail
                  label="Activity"
                  value={invoice.activity_id || "Standalone"}
                />
              </div>

              {assessment && (
                <div className="mx-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Trust Assessment
                      </p>

                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-3xl font-bold text-slate-950 dark:text-white">
                          {assessment.trustScore}
                        </span>

                        <span className="text-sm text-slate-400 dark:text-slate-500">
                          / 100
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${riskClass(
                        assessment.riskLevel
                      )}`}
                    >
                      {assessment.riskLevel} RISK
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Signal
                      label="Duplicate Detected"
                      value={
                        assessment.duplicateDetected
                          ? "Yes"
                          : "No"
                      }
                      danger={assessment.duplicateDetected}
                    />

                    <Signal
                      label="Document Verified"
                      value={
                        assessment.documentVerified
                          ? "Yes"
                          : "No"
                      }
                      danger={!assessment.documentVerified}
                    />

                    <Signal
                      label="Requires Review"
                      value={
                        assessment.requiresReview
                          ? "Yes"
                          : "No"
                      }
                      danger={assessment.requiresReview}
                    />

                    <Signal
                      label="Risk Signals"
                      value={assessment.signals?.length || 0}
                      danger={
                        (assessment.signals?.length || 0) > 0
                      }
                    />
                  </div>

                  {assessment.signals?.length > 0 && (
                    <div className="mt-5 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Detected Signals
                      </p>

                      {assessment.signals.map((signal) => (
                        <div
                          key={signal.code}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <AlertTriangle
                              size={16}
                              className="mt-0.5 shrink-0 text-amber-500"
                            />

                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {signal.code.replaceAll("_", " ")}
                              </p>

                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {signal.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Supporting Evidence
                    </h3>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Evidence already linked to this invoice
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                    {evidence.length}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {evidence.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center">
                      <FileCheck2
                        size={22}
                        className="mx-auto text-slate-300 dark:text-slate-400"
                      />

                      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
                        No supporting evidence
                      </p>

                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        This contributes to invoice risk.
                      </p>
                    </div>
                  ) : (
                    evidence.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {item.file_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {item.evidence_type} ·{" "}
                            {item.verification_status}
                          </p>
                        </div>

                        {item.verification_status ===
                        "VERIFIED" ? (
                          <CheckCircle2
                            size={18}
                            className="shrink-0 text-emerald-500"
                          />
                        ) : (
                          <AlertTriangle
                            size={18}
                            className="shrink-0 text-amber-500"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {reviews.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Review History
                  </h3>

                  <div className="mt-4 space-y-3">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {review.status}
                          </span>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold ${riskClass(
                              review.priority
                            )}`}
                          >
                            {review.priority}
                          </span>
                        </div>

                        {review.reason && (
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {review.reason}
                          </p>
                        )}

                        {review.resolution && (
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                            Resolution: {review.resolution}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 p-6">
                <div className="flex flex-col gap-3">
                  {canReview &&
                    ["PENDING", "VERIFIED"].includes(
                      invoice.status
                    ) && (
                      <button
                        onClick={handleVerify}
                        disabled={actionLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 dark:bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <ShieldCheck size={17} />
                        )}
                        Run Verification
                      </button>
                    )}

                  {canReview &&
                    invoice.status === "REQUIRES_REVIEW" && (
                      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div>
                          <p className="text-sm font-bold text-amber-900">
                            Human review required
                          </p>

                          <p className="mt-1 text-xs leading-5 text-amber-700">
                            Review the detected signals and supporting
                            evidence before making a decision.
                          </p>
                        </div>

                        <textarea
                          value={reviewResolution}
                          onChange={(event) =>
                            setReviewResolution(
                              event.target.value
                            )
                          }
                          placeholder="Optional review resolution..."
                          rows={3}
                          className="w-full rounded-xl border border-amber-200 bg-white dark:bg-slate-900 p-3 text-sm outline-none focus:border-amber-400"
                        />

                        <div className="grid gap-2 sm:grid-cols-3">
                          <button
                            onClick={() =>
                              handleReview("APPROVE")
                            }
                            disabled={actionLoading}
                            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() =>
                              handleReview("REJECT")
                            }
                            disabled={actionLoading}
                            className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>

                          <button
                            onClick={() =>
                              handleReview("ESCALATE")
                            }
                            disabled={actionLoading}
                            className="rounded-xl bg-slate-800 px-3 dark:bg-slate-700 py-2.5 text-sm font-bold text-white hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50"
                          >
                            Escalate
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-100 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                    Submit Invoice
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Create an invoice record for verification.
                  </p>
                </div>

                <button
                  onClick={() => setShowCreate(false)}
                  className="text-sm font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>

            <form
              onSubmit={handleCreate}
              className="space-y-5 p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Vendor Name"
                  value={form.vendorName}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      vendorName: value,
                    })
                  }
                  required
                />

                <Input
                  label="Invoice Number"
                  value={form.invoiceNumber}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      invoiceNumber: value,
                    })
                  }
                  required
                />

                <Input
                  label="Invoice Date"
                  type="date"
                  value={form.invoiceDate}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      invoiceDate: value,
                    })
                  }
                />

                <Input
                  label="Due Date"
                  type="date"
                  value={form.dueDate}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      dueDate: value,
                    })
                  }
                />

                <Input
                  label="Amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      amount: value,
                    })
                  }
                  required
                />

                <Input
                  label="Currency"
                  value={form.currency}
                  maxLength={3}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      currency: value,
                    })
                  }
                  required
                />

                <Input
                  label="Activity ID"
                  type="number"
                  min="1"
                  value={form.activityId}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      activityId: value,
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  )}
                  Submit Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>

        <Icon size={18} className="text-slate-400 dark:text-slate-500" />
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
        {value}
      </p>
    </div>
  );
}

function Signal({ label, value, danger }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>

      <span
        className={`text-xs font-bold ${
          danger ? "text-amber-600" : "text-emerald-600"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  ...props
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-slate-400 dark:border-slate-600"
        {...props}
      />
    </label>
  );
}
