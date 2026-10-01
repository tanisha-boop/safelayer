import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock3,
  FileCheck2,
} from "lucide-react";
import { api } from "../services/api";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

function riskClasses(risk) {
  switch (risk) {
    case "CRITICAL":
      return "bg-red-100 text-red-700 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800";
  }
}

function RiskIcon({ risk }) {
  if (risk === "CRITICAL" || risk === "HIGH") {
    return <ShieldAlert size={20} />;
  }

  if (risk === "MEDIUM") {
    return <AlertTriangle size={20} />;
  }

  return <ShieldCheck size={20} />;
}

function signalLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function signalValue(value) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === undefined) {
    return "—";
  }

  return String(value);
}

export default function RiskTrust() {
  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [assessment, setAssessment] = useState(null);

  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessing, setAssessing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadActivities = useCallback(async () => {
    try {
      setLoadingActivities(true);
      setError("");

      const result = await api.getActivities();
      const rows = result?.data || [];

      setActivities(rows);

      if (rows.length > 0) {
        setSelectedId((current) => current || String(rows[0].id));
      }
    } catch (err) {
      setError(
        err.message || "Failed to load activities."
      );
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  async function loadAssessment(activityId) {
    if (!activityId) {
      setAssessment(null);
      return;
    }

    try {
      setLoadingAssessment(true);
      setError("");
      setMessage("");

      const result =
        await api.getTrustAssessment(activityId);

      setAssessment(result?.data || result || null);
    } catch (err) {
      if (
        err.message?.toLowerCase().includes("not found")
      ) {
        setAssessment(null);
      } else {
        setError(
          err.message ||
            "Failed to load trust assessment."
        );
      }
    } finally {
      setLoadingAssessment(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => {
    loadActivities();
  }, 0);

  return () => clearTimeout(timer);
}, [loadActivities]);

useEffect(() => {
  if (!selectedId) {
    return;
  }

  const timer = setTimeout(() => {
    loadAssessment(selectedId);
  }, 0);

  return () => clearTimeout(timer);
}, [selectedId]);

  async function assess() {
    if (!selectedId) return;

    try {
      setAssessing(true);
      setError("");
      setMessage("");

      const result =
        await api.assessTrust(selectedId);

      setAssessment(result?.data || result || null);
      setMessage(
        "Trust assessment completed successfully."
      );
    } catch (err) {
      setError(
        err.message ||
          "Failed to run trust assessment."
      );
    } finally {
      setAssessing(false);
    }
  }

  const selectedActivity = activities.find(
    (activity) =>
      String(activity.id) === String(selectedId)
  );

  const score =
    assessment?.score ??
    assessment?.trustScore ??
    null;

  const risk =
    assessment?.riskLevel ??
    assessment?.risk ??
    "UNKNOWN";

  const requiresReview =
    assessment?.requiresReview ??
    assessment?.requires_review ??
    false;

  const signals =
    assessment?.signals ||
    assessment?.checks ||
    {};

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-800">
              <Shield size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Risk & Trust
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Assess operational activity using SafeLayer trust signals.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            selectedId && loadAssessment(selectedId)
          }
          disabled={
            loadingAssessment ||
            !selectedId
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              loadingAssessment
                ? "animate-spin"
                : ""
            }
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

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Field activities
          </div>

          {loadingActivities ? (
            <div className="flex justify-center py-10">
              <Loader2
                size={22}
                className="animate-spin text-slate-400 dark:text-slate-500"
              />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No activities found.
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() =>
                    setSelectedId(
                      String(activity.id)
                    )
                  }
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    String(activity.id) ===
                    String(selectedId)
                      ? "border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                      : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {activity.title ||
                      `Activity #${activity.id}`}
                  </div>

                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {activity.activity_type ||
                      activity.activityType ||
                      "Activity"}{" "}
                    ·{" "}
                    {activity.status || "—"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="space-y-6">
          {!selectedActivity ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-16 text-center">
              <ShieldCheck
                size={32}
                className="mx-auto text-slate-300 dark:text-slate-400"
              />

              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Select an activity
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Selected activity
                    </div>

                    <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
                      {selectedActivity.title ||
                        `Activity #${selectedActivity.id}`}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {selectedActivity.activity_type ||
                        selectedActivity.activityType ||
                        "Field activity"}
                    </p>
                  </div>

                  <button
                    onClick={assess}
                    disabled={assessing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {assessing ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <ShieldCheck size={16} />
                    )}

                    Run Assessment
                  </button>
                </div>
              </div>

              {loadingAssessment ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-20 shadow-sm">
                  <Loader2
                    size={26}
                    className="animate-spin text-slate-400 dark:text-slate-500"
                  />
                </div>
              ) : !assessment ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-16 text-center shadow-sm">
                  <Shield
                    size={32}
                    className="mx-auto text-slate-300 dark:text-slate-400"
                  />

                  <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No trust assessment yet
                  </p>

                  <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                    Run an assessment to evaluate this activity.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div
                      className={`rounded-2xl border p-6 ${riskClasses(
                        risk
                      )}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider">
                          Risk level
                        </div>

                        <RiskIcon risk={risk} />
                      </div>

                      <div className="mt-4 text-3xl font-black">
                        {risk}
                      </div>

                      <p className="mt-2 text-sm opacity-80">
                        Current trust assessment classification.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Trust score
                        </div>

                        <ShieldCheck
                          size={20}
                          className="text-slate-400 dark:text-slate-500"
                        />
                      </div>

                      <div className="mt-4 text-4xl font-black text-slate-950 dark:text-white">
                        {score !== null
                          ? `${score}/100`
                          : "—"}
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-slate-950 transition-all"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                Number(score) || 0
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-5 ${
                      requiresReview
                        ? "border-orange-200 bg-orange-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {requiresReview ? (
                        <ShieldAlert
                          size={20}
                          className="mt-0.5 text-orange-600"
                        />
                      ) : (
                        <CheckCircle2
                          size={20}
                          className="mt-0.5 text-emerald-600"
                        />
                      )}

                      <div>
                        <div
                          className={`text-sm font-bold ${
                            requiresReview
                              ? "text-orange-800"
                              : "text-emerald-800"
                          }`}
                        >
                          {requiresReview
                            ? "Human review required"
                            : "No human review required"}
                        </div>

                        <p
                          className={`mt-1 text-sm ${
                            requiresReview
                              ? "text-orange-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {requiresReview
                            ? "The assessment indicates that this activity should be reviewed before it is treated as trusted."
                            : "The current assessment does not require escalation to human review."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                      <FileCheck2
                        size={18}
                        className="text-slate-400 dark:text-slate-500"
                      />

                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Trust signals
                      </h3>
                    </div>

                    {Object.keys(signals).length === 0 ? (
                      <p className="mt-5 text-sm text-slate-400 dark:text-slate-500">
                        No signal details were returned.
                      </p>
                    ) : (
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {Object.entries(signals).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4"
                            >
                              <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {signalLabel(key)}
                              </div>

                              <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {signalValue(value)}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={17}
                          className="text-slate-400 dark:text-slate-500"
                        />

                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Activity location
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                        Location consistency is evaluated by the Trust Engine when location evidence is available.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Clock3
                          size={17}
                          className="text-slate-400 dark:text-slate-500"
                        />

                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Assessment time
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {formatDate(
                          assessment.assessedAt ||
                            assessment.createdAt ||
                            assessment.assessed_at
                        )}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
