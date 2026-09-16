import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export default function MetricCard({
  label,
  value,
  change,
  description,
  icon: Icon,
  negative,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Icon size={19} />
        </div>

        <span
          className={
            "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold " +
            (negative
              ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300")
          }
        >
          {negative ? (
            <ArrowDownRight size={13} />
          ) : (
            <ArrowUpRight size={13} />
          )}
          {change}
        </span>
      </div>

      <div className="mt-5 text-sm font-medium text-slate-500 dark:text-slate-300">
        {label}
      </div>

      <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-400 dark:text-slate-400">
        {description}
      </div>
    </button>
  )
}
