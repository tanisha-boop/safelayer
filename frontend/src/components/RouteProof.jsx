import { useEffect, useState } from "react";
import {
  Activity,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { api } from "../services/api";

function RouteProof({ user }) {
  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [proof, setProof] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingProof, setLoadingProof] = useState(false);
  const [working, setWorking] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const result = await api.getActivities();
      const data = result?.data || [];

      const list = Array.isArray(data) ? data : [];

      setActivities(list);

      if (!selectedId && list.length > 0) {
        setSelectedId(String(list[0].id));
      }
    } catch (err) {
      setError(err.message || "Unable to load activities.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProof(id = selectedId) {
    if (!id) {
      setProof([]);
      return;
    }

    setLoadingProof(true);
    setError("");

    try {
      const result = await api.getRouteProof(id);

      setProof(
        Array.isArray(result?.data)
          ? result.data
          : []
      );
    } catch (err) {
      setError(err.message || "Unable to load RouteProof.");
      setProof([]);
    } finally {
      setLoadingProof(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadProof(selectedId);
    }
  }, [selectedId]);

  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            "Geolocation is not supported by this browser."
          )
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        },
        () => {
          reject(
            new Error(
              "Location permission is required for RouteProof."
            )
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  async function runAction(action) {
    if (!selectedId) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const location = await getLocation();

      if (action === "checkIn") {
        await api.routeProofCheckIn(
          selectedId,
          location
        );
      }

      if (action === "gps") {
        await api.routeProofGps(
          selectedId,
          location
        );
      }

      if (action === "checkOut") {
        await api.routeProofCheckOut(
          selectedId,
          location
        );
      }

      if (action === "checkIn") {
        setMessage("Check-in recorded successfully.");
      }

      if (action === "gps") {
        setMessage("GPS update recorded successfully.");
      }

      if (action === "checkOut") {
        setMessage("Check-out recorded successfully.");
      }

      await loadActivities();
      await loadProof(selectedId);
    } catch (err) {
      setError(
        err.message || "RouteProof action failed."
      );
    } finally {
      setWorking(false);
    }
  }

  const activity = activities.find(
    (item) =>
      String(item.id) === String(selectedId)
  );

  const hasCheckIn = proof.some(
    (item) => item.event_type === "CHECK_IN"
  );

  const hasCheckOut = proof.some(
    (item) => item.event_type === "CHECK_OUT"
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Navigation size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                RouteProof
              </h1>

              <p className="text-sm text-slate-500">
                Capture field presence using GPS,
                timestamps, and activity state.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            loadActivities();

            if (selectedId) {
              loadProof(selectedId);
            }
          }}
          className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
          title="Refresh"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Field activities
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Choose an activity to record RouteProof.
          </p>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Loading activities...
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {activities.map((item) => {
                const active =
                  String(item.id) ===
                  String(selectedId);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedId(String(item.id))
                    }
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {item.title}
                    </p>

                    <p
                      className={`mt-1 text-xs ${
                        active
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      #{item.id} ·{" "}
                      {item.activity_type} ·{" "}
                      {item.status}
                    </p>
                  </button>
                );
              })}

              {!activities.length && (
                <p className="py-6 text-center text-sm text-slate-400">
                  No activities found.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Selected activity
            </p>

            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {activity?.title ||
                "No activity selected"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {activity
                ? `#${activity.id} · ${activity.activity_type} · ${activity.status}`
                : "Select an activity."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  working ||
                  hasCheckIn ||
                  activity?.status !== "PENDING"
                }
                onClick={() =>
                  runAction("checkIn")
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <MapPin size={16} />
                Check in
              </button>

              <button
                type="button"
                disabled={
                  working ||
                  activity?.status !== "IN_PROGRESS"
                }
                onClick={() =>
                  runAction("gps")
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Crosshair size={16} />
                GPS update
              </button>

              <button
                type="button"
                disabled={
                  working ||
                  hasCheckOut ||
                  activity?.status !== "IN_PROGRESS"
                }
                onClick={() =>
                  runAction("checkOut")
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Activity size={16} />
                Check out
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              RouteProof requests browser location only
              when a field action is performed.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                RouteProof event timeline
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Recorded GPS events for this activity.
              </p>
            </div>

            {loadingProof ? (
              <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Loading events...
              </div>
            ) : proof.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No RouteProof events yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {proof.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-4 p-5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <MapPin size={17} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {event.event_type}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {event.first_name}{" "}
                        {event.last_name} ·{" "}
                        {new Date(
                          event.recorded_at
                        ).toLocaleString()}
                      </p>

                      <p className="mt-1 font-mono text-xs text-slate-400">
                        {event.latitude},{" "}
                        {event.longitude} · ±
                        {event.accuracy_meters ?? "—"}m
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Signed in as {user?.first_name}{" "}
        {user?.last_name} · {user?.role}
      </p>
    </section>
  );
}

export default RouteProof;