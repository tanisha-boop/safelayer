import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileWarning, Plus, ShieldCheck, WalletCards } from 'lucide-react'
import MetricCard from './MetricCard'

const activities = [
  { type: 'Evidence verified', title: 'Site inspection #FL-1048', person: 'Marco Dela Cruz', time: '8 min ago', status: 'Verified' },
  { type: 'Field activity', title: 'Delivery confirmation #DL-2931', person: 'James Rivera', time: '24 min ago', status: 'Review' },
  { type: 'Payment recorded', title: 'Collection #CL-8821', person: 'Anna Santos', time: '41 min ago', status: 'Verified' },
  { type: 'Evidence submitted', title: 'Service visit #SV-4310', person: 'Miguel Torres', time: '1 hr ago', status: 'Pending' },
]

const attention = [
  { icon: FileWarning, title: 'Invoice mismatch detected', description: 'INV-2048 has a 12.6% amount variance.', level: 'High' },
  { icon: AlertTriangle, title: 'Missing field evidence', description: '3 activities have no completion evidence.', level: 'Medium' },
  { icon: WalletCards, title: 'Cash reconciliation variance', description: '₱8,450 remains unreconciled today.', level: 'High' },
]

function TrustOverview() {
  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='font-bold text-slate-950'>Trust overview</h2>
          <p className='mt-1 text-sm text-slate-400'>Operational confidence across your workspace</p>
        </div>
        <ShieldCheck size={20} className='text-emerald-500' />
      </div>
      <div className='mt-7 flex items-center gap-6'>
        <div className='relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[12px] border-emerald-100'>
          <div className='absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-emerald-500 border-r-emerald-500 -rotate-12'></div>
          <div className='text-center'>
            <div className='text-3xl font-bold text-slate-950'>94</div>
            <div className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Score</div>
          </div>
        </div>
        <div className='flex-1 space-y-4'>
          <div>
            <div className='mb-1 flex justify-between text-xs'>
              <span className='font-medium text-slate-500'>Evidence integrity</span><span className='font-semibold text-slate-700'>97%</span>
            </div>
            <div className='h-2 rounded-full bg-slate-100'><div className='h-2 w-[97%] rounded-full bg-emerald-500'></div></div>
          </div>
          <div>
            <div className='mb-1 flex justify-between text-xs'>
              <span className='font-medium text-slate-500'>Activity compliance</span><span className='font-semibold text-slate-700'>94%</span>
            </div>
            <div className='h-2 rounded-full bg-slate-100'><div className='h-2 w-[94%] rounded-full bg-emerald-500'></div></div>
          </div>
          <div>
            <div className='mb-1 flex justify-between text-xs'>
              <span className='font-medium text-slate-500'>Financial reconciliation</span><span className='font-semibold text-slate-700'>91%</span>
            </div>
            <div className='h-2 rounded-full bg-slate-100'><div className='h-2 w-[91%] rounded-full bg-amber-400'></div></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Dashboard({ setActivePage }) {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
        <div>
          <p className='text-sm font-medium text-slate-400'>Monday, September 14, 2026</p>
          <h1 className='mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl'>Good morning, Tanisha.</h1>
          <p className='mt-2 text-sm text-slate-500'>Here is what is happening across your operations today.</p>
        </div>
        <div className='flex gap-2'>
          <button className='rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50'>Export</button>
          <button onClick={() => setActivePage('Field Operations')} className='flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800'><Plus size={17} /> New activity</button>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <MetricCard label='Active activities' value='128' change='8.4%' description='vs. last week' icon={Activity} />
        <MetricCard label='Evidence verified' value='1,284' change='12.1%' description='vs. last week' icon={CheckCircle2} />
        <MetricCard label='Open reviews' value='24' change='5.2%' description='vs. last week' icon={Clock3} negative />
        <MetricCard label='Risk exposure' value='₱186K' change='3.8%' description='vs. last week' icon={AlertTriangle} negative />
      </div>

      <div className='grid gap-6 xl:grid-cols-[1.45fr_1fr]'>
        <section className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
          <div className='flex items-center justify-between border-b border-slate-100 p-6'>
            <div><h2 className='font-bold text-slate-950'>Recent activity</h2><p className='mt-1 text-sm text-slate-400'>Latest operational events across your workspace</p></div>
            <button onClick={() => setActivePage('Field Operations')} className='flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-950'>View all <ArrowRight size={15} /></button>
          </div>
          <div className='divide-y divide-slate-100'>
            {activities.map((item) => (
              <div key={item.title} className='flex items-center gap-4 p-5'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100'><Activity size={18} className='text-slate-600' /></div>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-semibold text-slate-800'>{item.title}</div>
                  <div className='mt-1 text-xs text-slate-400'>{item.type} · {item.person}</div>
                </div>
                <div className='hidden text-right sm:block'><div className='text-xs text-slate-400'>{item.time}</div><div className={`mt-1 text-xs font-semibold ${item.status === 'Verified' ? 'text-emerald-600' : item.status === 'Review' ? 'text-amber-600' : 'text-slate-500'}`}>{item.status}</div></div>
              </div>
            ))}
          </div>
        </section>

        <TrustOverview />
      </div>

      <section className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
        <div className='border-b border-slate-100 p-6'>
          <div><h2 className='font-bold text-slate-950'>Requires attention</h2><p className='mt-1 text-sm text-slate-400'>Items that may require review or action</p></div>
        </div>
        <div className='divide-y divide-slate-100'>
          {attention.map(({ icon: Icon, title, description, level }) => (
            <button key={title} className='flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500'><Icon size={18} /></div>
              <div className='min-w-0 flex-1'><div className='text-sm font-semibold text-slate-800'>{title}</div><div className='mt-1 text-xs text-slate-400'>{description}</div></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${level === 'High' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{level}</span>
              <ArrowRight size={16} className='text-slate-300' />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
