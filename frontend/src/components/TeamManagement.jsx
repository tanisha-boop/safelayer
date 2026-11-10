import { useCallback, useEffect, useState } from "react";
import {
  UsersRound,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { api } from "../services/api";

const roles = [
  "ADMIN",
  "MANAGER",
  "FIELD_WORKER",
  "FINANCE",
  "AUDITOR",
];

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

export default function TeamManagement({ user }) {
  const permissions = (user?.permissions || []).map((item) =>
    typeof item === "string" ? item : item.name
  );

  const canCreate = permissions.includes("users:create");
  const canUpdate = permissions.includes("users:update");
  const canDeactivate = permissions.includes("users:deactivate");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "FIELD_WORKER",
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await api.getUsers();
      setUsers(Array.isArray(result?.data) ? result.data : []);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load team members."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    api
      .getUsers()
      .then((result) => {
        if (isMounted) {
          setUsers(Array.isArray(result?.data) ? result.data : []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(getErrorMessage(err, "Unable to load team members."));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password.length < 8) {
      setError("The initial password must contain at least 8 characters.");
      return;
    }

    setSaving(true);

    try {
      await api.createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "FIELD_WORKER",
      });

      setSuccess("Employee account created successfully.");
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create the employee account."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(employee, nextRole) {
    if (nextRole === employee.role) return;

    setError("");
    setSuccess("");
    setUpdatingId(employee.id);

    try {
      await api.updateUser(employee.id, { role: nextRole });
      setSuccess("Employee role updated successfully.");
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update the employee role."));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeactivate(employee) {
    const name = `${employee.first_name} ${employee.last_name}`;

    if (!window.confirm(`Deactivate ${name}'s account? They will no longer be able to sign in.`)) {
      return;
    }

    setError("");
    setSuccess("");
    setDeactivatingId(employee.id);

    try {
      await api.deactivateUser(employee.id);
      setSuccess("Employee account deactivated successfully.");
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to deactivate the employee account."));
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Organization
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Team Management
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Manage employee accounts and control access to your organization's workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

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

      {canCreate && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <UserPlus size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Create employee account
              </h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Add a team member to your organization
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">First name</span>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleFormChange}
                minLength={2}
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="First name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Last name</span>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleFormChange}
                minLength={2}
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Last name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleFormChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="employee@company.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Initial password</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleFormChange}
                minLength={8}
                maxLength={100}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="At least 8 characters"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Assign role</span>
              <select
                name="role"
                value={form.role}
                onChange={handleFormChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{role.replace("_", " ")}</option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <UserPlus size={16} />
                {saving ? "Creating account..." : "Create employee"}
              </button>
            </div>

            <p className="text-xs leading-5 text-slate-400 sm:col-span-2 lg:col-span-3">
              Share the initial password securely with the employee. OWNER accounts can only be created through organization registration.
            </p>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <UsersRound size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Organization members</h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {users.length} account{users.length === 1 ? "" : "s"} in this organization
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={15} />
            Organization-scoped access
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading team members...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <UsersRound size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">No team members found</p>
            <p className="mt-1 text-xs text-slate-400">Employee accounts will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Joined</th>
                  {(canUpdate || canDeactivate) && (
                    <th className="px-6 py-4 text-right font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((employee) => {
                  const role = employee.rbac_roles?.split(",")[0] || employee.role;
                  const active = Boolean(employee.is_active);
                  const isOwner = role === "OWNER";

                  return (
                    <tr key={employee.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{employee.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        {canUpdate && !isOwner && active ? (
                          <select
                            value={role}
                            disabled={updatingId === employee.id}
                            onChange={(event) => handleRoleChange(employee, event.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          >
                            {roles.map((item) => (
                              <option key={item} value={item}>{item.replace("_", " ")}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {role?.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {employee.created_at ? new Date(employee.created_at).toLocaleDateString() : "—"}
                      </td>
                      {(canUpdate || canDeactivate) && (
                        <td className="px-6 py-4 text-right">
                          {canDeactivate && !isOwner && active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(employee)}
                              disabled={deactivatingId === employee.id}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              <UserX size={14} />
                              {deactivatingId === employee.id ? "Deactivating..." : "Deactivate"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
