import {
  CheckCircle2,
  KeyRound,
  Monitor,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

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

export default function Settings({ user, theme }) {
  const firstName = user?.firstName || user?.first_name || "User";
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

  const displayName = `${firstName} ${lastName}`.trim();

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
          Review your SafeLayer account, access context, appearance, and
          security controls.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <UserRound
                  size={18}
                  className="text-slate-600 dark:text-slate-300"
                />
              </div>

              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Account profile
                </h2>

                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Authenticated account context
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <InfoRow label="Name" value={displayName} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Role" value={role} />
            <InfoRow label="Organization" value={organization} />
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Monitor
                size={18}
                className="text-slate-600 dark:text-slate-300"
              />
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
              <ShieldCheck
                size={18}
                className="text-slate-600 dark:text-slate-300"
              />
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

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />

          <div>
            <h2 className="font-bold text-emerald-900 dark:text-emerald-300">
              Security controls are centrally enforced
            </h2>

            <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-400">
              SafeLayer keeps authentication, authorization, organization
              boundaries, and audit protections in the application security
              layer. This page intentionally does not present unsupported
              account controls as if they were implemented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}