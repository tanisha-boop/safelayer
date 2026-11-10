import { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Monitor,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { api } from "../services/api";

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="break-all text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function SecurityItem({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <Icon size={18} className="text-slate-600 dark:text-slate-300" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {text}
        </p>
      </div>
    </div>
  );
}

export default function Settings({ user, theme, onUserUpdated }) {
  const firstName = user?.firstName || user?.first_name || "";
  const lastName = user?.lastName || user?.last_name || "";
  const email = user?.email || "Not available";

  const role =
    user?.roles?.[0]?.name ||
    user?.role ||
    "USER";

  const organization =
    user?.organization?.name ||
    user?.organizationName ||
    "Current organization";

  const [form, setForm] = useState({
    firstName,
    lastName,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasChanges =
    form.firstName.trim() !== firstName ||
    form.lastName.trim() !== lastName;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    if (
      form.firstName.trim().length < 2 ||
      form.lastName.trim().length < 2
    ) {
      setError("Each name must contain at least 2 characters.");
      return;
    }

    setSaving(true);

    try {
      const result = await api.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });

      const updatedUser = result?.data?.user || result?.user;

      if (!updatedUser) {
        throw new Error("The server did not return the updated profile.");
      }

      onUserUpdated(updatedUser);
      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      setError(err.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          Settings
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Manage your personal profile and review your account access,
          organization, appearance, and security information.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Account profile
              </h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Update your personal information
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  First name
                </span>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={100}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Last name
                </span>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={100}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800">
              <InfoRow label="Email address" value={email} />
              <InfoRow label="Role" value={role} />
              <InfoRow label="Organization" value={organization} />
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            {success && (
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                {success}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Your role and organization cannot be changed here.
              </p>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Monitor size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Appearance
              </h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Workspace display preference
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Current theme
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Use the appearance control in the top bar to switch themes.
              SafeLayer stores the preference locally for the next session.
            </p>
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <ShieldCheck size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Security & access
              </h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Controls enforced by the SafeLayer platform
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <SecurityItem
            icon={KeyRound}
            title="Authenticated sessions"
            text="Authenticated requests are protected by the application's session and token security layer."
          />
          <SecurityItem
            icon={UsersRound}
            title="Role-based access"
            text="Permissions are separated by role so operational actions can be restricted to authorized users."
          />
          <SecurityItem
            icon={ShieldCheck}
            title="Organization isolation"
            text="Operational records are scoped to the appropriate organization boundary rather than treated as one shared dataset."
          />
          <SecurityItem
            icon={CheckCircle2}
            title="Auditability"
            text="Important operational actions can be represented in the audit history for later investigation and accountability."
          />
        </div>
      </section>
    </div>
  );
}
