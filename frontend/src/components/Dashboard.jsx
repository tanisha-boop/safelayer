import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import MetricCard from './MetricCard'
import { api } from '../services/api'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return 'Unknown time'

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAction(action) {
  return String(action || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function timeAgo(value) {
  if (!value) return ''

  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)

  if (hours < 24) return `${hours} hr ago`

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function TrustOverview({ risk }) {
  const score = Number(risk?.averageTrustScore || 0)

  const evidenceIntegrity =
    risk?.total > 0
      ? Math.round(
          ((risk.low + risk.medium) / risk.total) * 100
        )
      : 0

  const reviewHealth =
    risk?.total > 0
      ? Math.round(
          ((risk.total - risk.requiresReview) / risk.total) * 100
        )
      : 0

  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='font-bold text-slate-950 dark:text-slate-100'>Trust overview</h2>
          <p className='mt-1 text-sm text-slate-400 dark:text-slate-500'>
            Latest risk assessment signals across your organization
          </p>
        </div>

        <ShieldCheck size={20} className='text-emerald-500' />
      </div>

      <div className='mt-7 flex items-center gap-6'>
        <div className='relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[12px] border-slate-100 dark:border-slate-800'>
          <div
            className='absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-emerald-500 border-r-emerald-500'
            style={{
              transform: `rotate(${score * 3.6 - 45}deg)`,
            }}
          />

          <div className='text-center'>
            <div className='text-3xl font-bold text-slate-950 dark:text-slate-100'>
              {score}
            </div>
            <div className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Avg score
            </div>
          </div>
        </div>

        <div className='flex-1 space-y-4'>
          <div>
            <div className='mb-1 flex justify-between text-xs'>
              <span className='font-medium text-slate-500 dark:text-slate-300'>
                Low / medium risk
              </span>
              <span className='font-semibold text-slate-700 dark:text-slate-200'>
                {evidenceIntegrity}%
              </span>
            </div>

            <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800'>
              <div
                className='h-2 rounded-full bg-emerald-500'
                style={{ width: `${evidenceIntegrity}%` }}
              />
            </div>
          </div>

          <div>
            <div className='mb-1 flex justify-between text-xs'>
              <span className='font-medium text-slate-500 dark:text-slate-300'>
                Assessments without review
              </span>
              <span className='font-semibold text-slate-700 dark:text-slate-200'>
                {reviewHealth}%
              </span>
            </div>

            <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800'>
              <div
                className='h-2 rounded-full bg-emerald-500'
                style={{ width: `${reviewHealth}%` }}
              />
            </div>
          </div>

          <div className='flex flex-wrap gap-2 pt-1 text-[11px] font-semibold'>
            <span className='rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
              Low {risk?.low || 0}
            </span>

            <span className='rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'>
              Medium {risk?.medium || 0}
            </span>

            <span className='rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'>
              High {risk?.high || 0}
            </span>

            <span className='rounded-full bg-red-50 px-2.5 py-1 text-red-700 dark:bg-red-950/40 dark:text-red-300'>
              Critical {risk?.critical || 0}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function SummaryCard({ label, value, description, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className='rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
    >
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-slate-500 dark:text-slate-300'>
          {label}
        </span>

        <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:text-slate-300 dark:bg-slate-800'>
          <Icon size={17} />
        </div>
      </div>

      <div className='mt-4 text-2xl font-bold text-slate-950 dark:text-slate-100'>
        {value}
      </div>

      <div className='mt-1 text-xs text-slate-400 dark:text-slate-500'>
        {description}
      </div>
    </button>
  )
}

export default function Dashboard({ setActivePage, user }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    try {
      setLoading(true)
      setError('')

      const response = await api.getDashboardOverview()
      setDashboard(response.data)
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    []
  )

  const firstName =
    user?.firstName ||
    user?.first_name ||
    user?.name?.split(' ')[0] ||
    'there'

  if (loading) {
    return (
      <div className='flex min-h-[500px] items-center justify-center'>
        <div className='flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-300'>
          <RefreshCw size={18} className='animate-spin' />
          Loading operational dashboard...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30'>
        <div className='flex items-center gap-3'>
          <AlertTriangle className='text-red-500' size={20} />

          <div>
            <h2 className='font-bold text-red-900 dark:text-red-300'>
              Dashboard unavailable
            </h2>

            <p className='mt-1 text-sm text-red-700 dark:text-red-400'>
              {error}
            </p>
          </div>
        </div>

        <button
          onClick={loadDashboard}
          className='mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700'
        >
          Try again
        </button>
      </div>
    )
  }

  const activities = dashboard.activities
  const evidence = dashboard.evidence
  const reviews = dashboard.reviews
  const invoices = dashboard.invoices
  const transactions = dashboard.transactions
  const risk = dashboard.risk

  const attention = [
    invoices.requiresReview > 0 && {
      icon: FileWarning,
      title: 'Invoices require review',
      description: `${invoices.requiresReview} invoice${invoices.requiresReview === 1 ? '' : 's'} currently require review.`,
      level: 'High',
      page: 'invoice-guard',
    },

    transactions.requiresReview > 0 && {
      icon: WalletCards,
      title: 'Transaction review required',
      description: `${formatCurrency(transactions.reviewAmount)} is currently tied to transactions requiring review.`,
      level: 'High',
      page: 'risk-trust',
    },

    reviews.highRiskOpen > 0 && {
      icon: AlertTriangle,
      title: 'High-risk reviews are open',
      description: `${reviews.highRiskOpen} active high or critical review${reviews.highRiskOpen === 1 ? '' : 's'}.`,
      level: 'Critical',
      page: 'reviews',
    },

    activities.pending > 0 && {
      icon: Activity,
      title: 'Pending field activities',
      description: `${activities.pending} field activit${activities.pending === 1 ? 'y is' : 'ies are'} waiting to start.`,
      level: 'Medium',
      page: 'field-operations',
    },
  ].filter(Boolean)

  return (
    <div className='space-y-6'>
      <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
        <div>
          <p className='text-sm font-medium text-slate-400 dark:text-slate-500'>
            {today}
          </p>

          <h1 className='mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100 sm:text-4xl'>
            Good morning, {firstName}.
          </h1>

          <p className='mt-2 text-sm text-slate-500 dark:text-slate-300'>
            Here is what is happening across your operations today.
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className='flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700'
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <MetricCard
          label='Active activities'
          value={activities.active}
          change={`${activities.completed} completed`}
          description='current workload'
          icon={Activity}
          onClick={() => setActivePage("field-operations")}
        />

        <MetricCard
          label='Evidence verified'
          value={evidence.verified}
          change={`${evidence.pending} pending`}
          description={`${evidence.total} total evidence items`}
          icon={CheckCircle2}
          onClick={() => setActivePage("evidence")}
        />

        <MetricCard
          label='Open reviews'
          value={reviews.open}
          change={`${reviews.highRiskOpen} high/critical`}
          description='requiring attention'
          icon={Clock3}
          negative={reviews.open > 0}
          onClick={() => setActivePage("reviews")}
        />

        <MetricCard
          label='Risk exposure'
          value={formatCurrency(risk.exposure)}
          change={`${risk.requiresReview} risk items`}
          description='transactions requiring review'
          icon={AlertTriangle}
          negative={risk.exposure > 0}
          onClick={() => setActivePage("risk-trust")}
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard
          label='Pending activities'
          value={activities.pending}
          description='waiting to start'
          icon={Clock3}
          onClick={() => setActivePage('field-operations')}
        />

        <SummaryCard
          label='Invoices to review'
          value={invoices.requiresReview}
          description='currently flagged'
          icon={FileWarning}
          onClick={() => setActivePage('invoice-guard')}
        />

        <SummaryCard
          label='Confirmed transactions'
          value={transactions.confirmed}
          description={`${formatCurrency(transactions.confirmedAmount)} confirmed`}
          icon={WalletCards}
          onClick={() => setActivePage('field-ledger')}
        />

        <SummaryCard
          label='Critical assessments'
          value={risk.critical}
          description={`${risk.high} additional high-risk`}
          icon={ShieldCheck}
          onClick={() => setActivePage('risk-trust')}
        />
      </div>

      <div className='grid gap-6 xl:grid-cols-[1.45fr_1fr]'>
        <section className='rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'>
          <div className='flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-6'>
            <div>
              <h2 className='font-bold text-slate-950 dark:text-slate-100'>
                Recent activity
              </h2>

              <p className='mt-1 text-sm text-slate-400 dark:text-slate-500'>
                Latest operational events across your workspace
              </p>
            </div>

            <button
              onClick={() => setActivePage('reviews')}
              className='flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:text-slate-100'
            >
              View reviews
              <ArrowRight size={15} />
            </button>
          </div>

          <div className='divide-y divide-slate-100 dark:divide-slate-800'>
            {dashboard.recentEvents.length === 0 ? (
              <div className='p-6 text-sm text-slate-400 dark:text-slate-500'>
                No operational events recorded yet.
              </div>
            ) : (
              dashboard.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className='flex items-center gap-4 p-5'
                >
                  <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800'>
                    <Activity size={18} className='text-slate-600 dark:text-slate-300' />
                  </div>

                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-semibold text-slate-800 dark:text-slate-100'>
                      {formatAction(event.action)}
                    </div>

                    <div className='mt-1 text-xs text-slate-400 dark:text-slate-500'>
                      {event.entityType}
                      {event.entityId ? ` #${event.entityId}` : ''}
                      {' · '}
                      {event.actorName}
                    </div>
                  </div>

                  <div className='hidden text-right sm:block'>
                    <div className='text-xs text-slate-400 dark:text-slate-500'>
                      {timeAgo(event.createdAt)}
                    </div>

                    <div className='mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300'>
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <TrustOverview risk={risk} />
      </div>

      <section className='rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='border-b border-slate-100 dark:border-slate-800 p-6'>
          <h2 className='font-bold text-slate-950 dark:text-slate-100'>
            Requires attention
          </h2>

          <p className='mt-1 text-sm text-slate-400 dark:text-slate-500'>
            Items that may require review or action
          </p>
        </div>

        <div className='divide-y divide-slate-100 dark:divide-slate-800'>
          {attention.length === 0 ? (
            <div className='flex items-center gap-3 p-6 text-sm text-emerald-700'>
              <CheckCircle2 size={18} />
              No outstanding attention items.
            </div>
          ) : (
            attention.map(
              ({ icon: Icon, title, description, level, page }) => (
                <button
                  key={title}
                  onClick={() => setActivePage(page)}
                  className='flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800'
                >
                  <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-300'>
                    <Icon size={18} />
                  </div>

                  <div className='min-w-0 flex-1'>
                    <div className='text-sm font-semibold text-slate-800 dark:text-slate-100'>
                      {title}
                    </div>

                    <div className='mt-1 text-xs text-slate-400 dark:text-slate-500'>
                      {description}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      level === 'Critical'
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
                        : level === 'High'
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {level}
                  </span>

                  <ArrowRight
                    size={16}
                    className='text-slate-300 dark:text-slate-300'
                  />
                </button>
              )
            )
          )}
        </div>
      </section>
    </div>
  )
}
