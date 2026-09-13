import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export default function MetricCard({ label, value, change, description, icon: Icon, negative }) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div className='flex items-start justify-between'>
        <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700'>
          <Icon size={19} />
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${negative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {negative ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
          {change}
        </span>
      </div>
      <div className='mt-5 text-sm font-medium text-slate-500'>{label}</div>
      <div className='mt-1 text-3xl font-bold tracking-tight text-slate-950'>{value}</div>
      <div className='mt-1 text-xs text-slate-400'>{description}</div>
    </div>
  )
}
