import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  FileText,
  Image,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

function formatSize(bytes) {
  if (!bytes) return "—";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClasses(status) {
  if (status === "VERIFIED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "REJECTED") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-amber-50 text-amber-700 border-amber-200";
}

function Evidence({ user }) {
  const [activities, setActivities] = useState([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [evidence, setEvidence] = useState([]);

  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadActivities() {
    setLoadingActivities(true);
    setError("");

    try {
      const result = await api.getActivities();
      const data = result?.data || result?.activities || result || [];

      setActivities(Array.isArray(data) ? data : []);

      if (Array.isArray(data) && data.length > 0) {
        setSelectedActivityId(String(data[0].id));
      }
    } catch (err) {
      setError(err.message || "Unable to load activities.");
    } finally {
      setLoadingActivities(false);
    }
  }

  async function loadEvidence(activityId) {
    if (!activityId) {
      setEvidence([]);
      return;
    }

    setLoadingEvidence(true);
    setError("");

    try {
      const result = await api.getEvidenceForActivity(activityId);
      const data = result?.data || result?.evidence || result || [];

      setEvidence(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load evidence.");
      setEvidence([]);
    } finally {
      setLoadingEvidence(false);
    }
  }

useEffect(() => {
  const timer = setTimeout(() => {
    loadActivities();
  }, 0);

  return () => clearTimeout(timer);
}, []);

useEffect(() => {
  if (!selectedActivityId) {
    return;
  }

  const timer = setTimeout(() => {
    loadEvidence(selectedActivityId);
  }, 0);

  return () => clearTimeout(timer);
}, [selectedActivityId]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];

    if (!file || !selectedActivityId) {
      return;
    }

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      await api.uploadEvidence(Number(selectedActivityId), file);

      setSuccess("Evidence uploaded successfully.");

      await loadEvidence(selectedActivityId);
    } catch (err) {
      setError(err.message || "Unable to upload evidence.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleVerification(id, status) {
    setError("");
    setSuccess("");
    setVerifyingId(id);

    try {
      await api.verifyEvidence(id, status);

      setSuccess(
        status === "VERIFIED"
          ? "Evidence verified successfully."
          : "Evidence rejected."
      );

      await loadEvidence(selectedActivityId);
    } catch (err) {
      setError(err.message || "Unable to update evidence verification.");
    } finally {
      setVerifyingId(null);
    }
  }

  const selectedActivity = activities.find(
    (activity) => String(activity.id) === String(selectedActivityId)
  );

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-800">
            <FileCheck2 size={20} />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Evidence
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload, inspect, and verify operational evidence.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Select activity
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Evidence is attached to a specific field activity.
            </p>
          </div>

          {loadingActivities ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-5 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No activities found.
              </p>

              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Create a field activity first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => {
                const active =
                  String(activity.id) === String(selectedActivityId);

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => setSelectedActivityId(String(activity.id))}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white dark:border-slate-700 dark:bg-slate-700"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800"
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        active ? "text-white" : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {activity.title}
                    </p>

                    <p
                      className={`mt-1 text-xs ${
                        active ? "text-slate-300 dark:text-slate-400" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      #{activity.id} · {activity.activity_type}
                    </p>

                    <p
                      className={`mt-1 text-xs ${
                        active ? "text-slate-400 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {activity.status}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Selected activity
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedActivity?.title || "No activity selected"}
                </h2>

                {selectedActivity && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Activity #{selectedActivity.id} ·{" "}
                    {selectedActivity.activity_type}
                  </p>
                )}
              </div>

              <label
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  !selectedActivityId || uploading
                    ? "cursor-not-allowed bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                    : "bg-slate-950 text-white dark:bg-slate-800 hover:bg-slate-800"
                }`}
              >
                {uploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}

                {uploading ? "Uploading..." : "Upload evidence"}

                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={!selectedActivityId || uploading}
                  onChange={handleUpload}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                    Evidence records
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Evidence attached to this field activity.
                  </p>
                </div>

                <div className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {evidence.length} record
                  {evidence.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {loadingEvidence ? (
              <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={18} className="animate-spin" />
                Loading evidence...
              </div>
            ) : evidence.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <FileText
                  size={32}
                  className="mx-auto text-slate-300 dark:text-slate-400"
                />

                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  No evidence uploaded yet.
                </p>

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Upload a photo or PDF to create the first evidence record.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {evidence.map((item) => {
                  const isImage = item.mime_type?.startsWith("image/");

                  return (
                    <div
                      key={item.id}
                      className="p-6"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {isImage ? (
                              <Image size={20} />
                            ) : (
                              <FileText size={20} />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {item.file_name}
                            </p>

                            <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                              <span>
                                Type: {item.evidence_type || "—"}
                              </span>

                              <span>
                                Size: {formatSize(item.file_size)}
                              </span>

                              <span>
                                Uploaded by:{" "}
                                {item.first_name || item.last_name
                                  ? `${item.first_name || ""} ${
                                      item.last_name || ""
                                    }`.trim()
                                  : item.uploaded_by || "—"}
                              </span>

                              <span>
                                Created: {formatDate(item.created_at)}
                              </span>
                            </div>

                            {item.file_hash && (
                              <p className="mt-3 break-all rounded-lg bg-slate-50 dark:bg-slate-800 p-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                SHA-256: {item.file_hash}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-3 xl:items-end">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                              item.verification_status
                            )}`}
                          >
                            {item.verification_status === "VERIFIED" ? (
                              <CheckCircle2 size={14} />
                            ) : item.verification_status === "REJECTED" ? (
                              <XCircle size={14} />
                            ) : (
                              <ShieldCheck size={14} />
                            )}

                            {item.verification_status || "PENDING"}
                          </span>

                          {item.verification_status !== "VERIFIED" && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={verifyingId === item.id}
                                onClick={() =>
                                  handleVerification(
                                    item.id,
                                    "VERIFIED"
                                  )
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {verifyingId === item.id
                                  ? "Saving..."
                                  : "Verify"}
                              </button>

                              <button
                                type="button"
                                disabled={verifyingId === item.id}
                                onClick={() =>
                                  handleVerification(
                                    item.id,
                                    "REJECTED"
                                  )
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-5">
            <div className="flex gap-3">
              <ShieldCheck
                size={19}
                className="mt-0.5 shrink-0 text-slate-700 dark:text-slate-200"
              />

              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Evidence integrity
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  SafeLayer stores a SHA-256 hash for each uploaded file.
                  Verification is a separate review action, so uploaded
                  evidence and reviewer decisions remain distinguishable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Signed in as {user?.first_name} {user?.last_name} · {user?.role}
      </p>
    </section>
  );
}

export default Evidence;