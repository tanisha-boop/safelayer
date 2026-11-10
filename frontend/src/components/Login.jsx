import { useState } from "react";
import {
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Login({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [organizationName, setOrganizationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const passwordChecks = [
    {
      label: "At least 8 characters",
      passed: password.length >= 8,
    },
    {
      label: "Uppercase and lowercase letters",
      passed: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    {
      label: "At least one number",
      passed: /[0-9]/.test(password),
    },
    {
      label: "At least one special character",
      passed: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const passwordScore = passwordChecks.filter((check) => check.passed).length;

  const passwordStrength = [
    { label: "Weak", color: "bg-slate-400", text: "text-slate-600" },
    { label: "Fair", color: "bg-slate-400", text: "text-slate-600" },
    { label: "Good", color: "bg-slate-400", text: "text-slate-600" },
    { label: "Strong", color: "bg-slate-400", text: "text-slate-600" },
  ][Math.max(0, passwordScore - 1)];

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isRegister) {
      if (passwordScore !== 4) {
        setError("Please choose a strong password that meets all the requirements.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        await onRegister({
          organizationName,
          firstName,
          lastName,
          email,
          password,
        });
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
        <div className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-bold text-slate-950">
                S
              </div>
              <div>
                <p className="font-bold">SafeLayer</p>
                <p className="text-xs text-slate-400">Trust Operations</p>
              </div>
            </div>

            <div className="mt-20">
              <p className="text-sm font-medium text-slate-400">
                OPERATIONAL TRUST
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">
                Know what happened in the field.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
                Connect field activity, evidence, reviews, risk, and operational
                records in one trusted system.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck size={18} />
            Evidence-first operational control
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-14">
          <div className="mx-auto max-w-md">
            <div className="lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-lg font-bold text-white">
                S
              </div>
              <p className="mt-4 text-xl font-bold text-slate-950">SafeLayer</p>
            </div>

            <div className="mt-8 lg:mt-0">
              <p className="text-sm font-medium text-slate-500">
                {isRegister ? "GET STARTED" : "WELCOME BACK"}
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-950">
                {isRegister ? "Create your workspace" : "Sign in to your workspace"}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {isRegister
                  ? "Register your organization and create its owner account."
                  : "Use your SafeLayer account to continue."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Organization name
                    </label>
                    <div className="relative">
                      <Building2
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="text"
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        placeholder="Your organization"
                        autoComplete="organization"
                        maxLength={150}
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        First name
                      </label>
                      <div className="relative">
                        <User
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          type="text"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          placeholder="First name"
                          autoComplete="given-name"
                          maxLength={100}
                          className={inputClass}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Last name
                      </label>
                      <div className="relative">
                        <User
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          type="text"
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          placeholder="Last name"
                          autoComplete="family-name"
                          maxLength={100}
                          className={inputClass}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={255}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    minLength={8}
                    maxLength={128}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {isRegister && password.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Password strength
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            password.length ? passwordStrength.text : "text-slate-400"
                          }`}
                        >
                          {password.length ? passwordStrength.label : "Not entered"}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[0, 1, 2, 3].map((segment) => (
                          <div
                            key={segment}
                            className={`h-1 rounded-full transition-colors ${
                              passwordScore > segment
                                ? passwordStrength.color
                                : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {passwordChecks.map((check) => (
                        <div
                          key={check.label}
                          className={`flex items-center gap-2 text-xs ${
                            check.passed ? "text-slate-600" : "text-slate-400"
                          }`}
                        >
                          <span className="font-semibold">
                            {check.passed ? "✓" : "○"}
                          </span>
                          <span>{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isRegister && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Confirm password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? isRegister
                    ? "Creating account..."
                    : "Signing in..."
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              {isRegister ? "Already have an account?" : "New to SafeLayer?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isRegister ? "login" : "register")}
                className="font-semibold text-slate-950 underline underline-offset-4 hover:text-slate-600"
              >
                {isRegister ? "Sign in" : "Create an account"}
              </button>
            </p>

            <p className="mt-6 text-center text-xs text-slate-400">
              SafeLayer development environment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
