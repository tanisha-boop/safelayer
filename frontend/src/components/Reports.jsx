import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileCheck2,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { api } from "../services/api";

function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Metric({ label, value, helper, emphasis = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${
          emphasis
            ? "text-slate-950 dark:text-white"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </p>

      {helper && (
        <p className="mt-1 text-xs leading-5 text-slate-400 dark:text-slate-500">
          {helper}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <Icon size={18} className="text-slate-700 dark:text-slate-200" />
      </div>

      <div>
        <h2 className="font-semibold text-slate-950 dark:text-white">
          {title}
        </h2>

        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total }) {
  const numericValue = Number(value || 0);
  const numericTotal = Number(total || 0);

  const percent = numericTotal
    ? Math.min(100, Math.round((numericValue / numericTotal) * 100))
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>

        <span className="shrink-0 text-slate-500 dark:text-slate-400">
          {numericValue} · {percent}%
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-slate-800 transition-all dark:bg-slate-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Insight({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <Icon size={17} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-300" />

        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");

    try {
      const result = await api.getReportsOverview();
      setReport(result?.data || result);
    } catch (err) {
      setError(err.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  const maxTrend = useMemo(() => {
    if (!report?.trend?.length) {
      return 1;
    }

    return Math.max(
      1,
      ...report.trend.map((item) => Number(item.total || 0))
    );
  }, [report]);

  const operationalHealth = useMemo(() => {
    if (!report) {
      return 0;
    }

    const activityRate = Number(report.activities?.completionRate || 0);
    const evidenceRate = Number(report.evidence?.verificationRate || 0);

    return Math.round((activityRate + evidenceRate) / 2);
  }, [report]);

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading operational intelligence...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/20">
        <p className="font-semibold text-red-800 dark:text-red-300">
          Unable to load reports
        </p>

        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>

        <button
          type="button"
          onClick={loadReport}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <RefreshCw size={15} />
          Try again
        </button>
      </section>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <BarChart3 size={17} />
            Operational intelligence
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Reports & Analytics
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Turn SafeLayer operational records into management-level visibility
            across field activity, evidence quality, human review, financial
            controls, and trust assessments.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReport}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} />
          Refresh data
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Operational health
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {operationalHealth}% execution quality
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Composite view based on activity completion and evidence
              verification performance. Use detailed metrics below to
              investigate the underlying signals.
            </p>
          </div>

          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-8 border-slate-700">
            <span className="text-2xl font-bold">{operationalHealth}%</span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Executive snapshot
          </p>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Current organization-scoped operating signals.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Field activities"
            value={report.activities.total}
            helper={`${report.activities.completionRate}% completion rate`}
            emphasis
          />

          <Metric
            label="Evidence records"
            value={report.evidence.total}
            helper={`${report.evidence.verificationRate}% verified`}
            emphasis
          />

          <Metric
            label="Review workload"
            value={report.reviews.open + report.reviews.inReview}
            helper={`${report.reviews.highCritical} high / critical items`}
            emphasis
          />

          <Metric
            label="Trust assessments"
            value={report.risk.total}
            helper={`Average trust score ${report.risk.averageTrustScore}`}
            emphasis
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Activity}
            title="Activity performance"
            description="How field work is progressing across the organization."
          />

          <div className="mt-6 space-y-5">
            <ProgressRow
              label="Completed"
              value={report.activities.completed}
              total={report.activities.total}
            />

            <ProgressRow
              label="In progress"
              value={report.activities.inProgress}
              total={report.activities.total}
            />

            <ProgressRow
              label="Pending"
              value={report.activities.pending}
              total={report.activities.total}
            />

            <ProgressRow
              label="Cancelled"
              value={report.activities.cancelled}
              total={report.activities.total}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={FileCheck2}
            title="Evidence assurance"
            description="Verification coverage for operational evidence."
          />

          <div className="mt-6 space-y-5">
            <ProgressRow
              label="Verified"
              value={report.evidence.verified}
              total={report.evidence.total}
            />

            <ProgressRow
              label="Pending verification"
              value={report.evidence.pending}
              total={report.evidence.total}
            />

            <ProgressRow
              label="Rejected"
              value={report.evidence.rejected}
              total={report.evidence.total}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={AlertTriangle}
            title="Human review operations"
            description="Current review queue and resolution state."
          />

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric label="Open" value={report.reviews.open} />
            <Metric label="In review" value={report.reviews.inReview} />
            <Metric label="Escalated" value={report.reviews.escalated} />
            <Metric label="Resolved" value={report.reviews.resolved} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Wallet}
            title="Financial controls"
            description="Invoice and transaction exposure requiring attention."
          />

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric label="Invoices" value={report.invoices.total} />

            <Metric
              label="Invoice review"
              value={report.invoices.requiresReview}
            />

            <Metric
              label="Confirmed transactions"
              value={report.transactions.confirmed}
              helper={money(report.transactions.confirmedAmount)}
            />

            <Metric
              label="Transaction review"
              value={report.transactions.requiresReview}
              helper={money(report.transactions.reviewAmount)}
            />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SectionHeader
          icon={ShieldCheck}
          title="Risk & Trust"
          description="Latest assessment distribution across assessed operational records."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Average trust"
            value={report.risk.averageTrustScore}
          />

          <Metric label="Low risk" value={report.risk.low} />
          <Metric label="Medium risk" value={report.risk.medium} />
          <Metric label="High risk" value={report.risk.high} />
          <Metric label="Critical risk" value={report.risk.critical} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Insight
            icon={FileWarning}
            title="Human review required"
            text={`${report.risk.requiresReview} current assessments require human review before the associated workflow should be treated as resolved.`}
          />

          <Insight
            icon={ShieldCheck}
            title="Assessment model"
            text="Risk distribution uses the latest assessment for each assessed activity or invoice, avoiding duplicate counting of historical assessment attempts."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SectionHeader
          icon={BarChart3}
          title="Seven-day activity trend"
          description="Field activities created during the latest seven-day reporting window."
        />

        {report.trend.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            No activity data is available for the selected period.
          </div>
        ) : (
          <div className="mt-8 flex items-end gap-3 overflow-x-auto pb-2">
            {report.trend.map((item) => {
              const total = Number(item.total || 0);
              const height = Math.max(
                8,
                Math.round((total / maxTrend) * 180)
              );

              return (
                <div
                  key={item.date}
                  className="flex min-w-20 flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {total}
                  </span>

                  <div
                    className="w-full max-w-14 rounded-t-lg bg-slate-800 dark:bg-slate-300"
                    style={{ height }}
                    title={`${total} activities, ${item.completed} completed`}
                  />

                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                      "en-PH",
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-300"
          />

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Reporting methodology
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Reports are organization-scoped and aggregate operational records
              from SafeLayer modules. Metrics reflect the current backend
              reporting snapshot rather than locally generated or simulated
              records.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
