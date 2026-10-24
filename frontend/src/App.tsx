import React, { useEffect, useState, useCallback, useRef } from 'react'
import type { Application, ApplicationStatus, Stats } from './types/application'
import {
  fetchApplications,
  fetchStats,
  createApplication,
  updateApplication,
  deleteApplication,
} from './services/api'

const statusOptions: { value: ApplicationStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

const statusBadgeStyles: Record<ApplicationStatus, string> = {
  wishlist: 'bg-slate-100 text-slate-700 border-slate-300',
  applied: 'bg-blue-50 text-blue-700 border-blue-300',
  interview: 'bg-amber-50 text-amber-800 border-amber-300',
  offer: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  rejected: 'bg-rose-50 text-rose-800 border-rose-300',
}

const kanbanColumns: {
  status: ApplicationStatus
  title: string
  headerColor: string
  badgeBg: string
  badgeText: string
}[] = [
  {
    status: 'wishlist',
    title: 'Wishlist',
    headerColor: 'text-slate-700',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-700',
  },
  {
    status: 'applied',
    title: 'Applied',
    headerColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
  },
  {
    status: 'interview',
    title: 'Interview',
    headerColor: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
  },
  {
    status: 'offer',
    title: 'Offer',
    headerColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
  },
  {
    status: 'rejected',
    title: 'Rejected',
    headerColor: 'text-rose-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
  },
]

function getTodayString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFutureDateString(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isFollowUpDue(followUpDate?: string): boolean {
  if (!followUpDate) return false
  const today = getTodayString()
  return followUpDate <= today
}

function isUpcomingInterview(interviewDate?: string): boolean {
  if (!interviewDate) return false
  const today = getTodayString()
  const maxDate = getFutureDateString(7)
  return interviewDate >= today && interviewDate <= maxDate
}

export function App() {
  const latestApplicationsRequest = useRef(0)
  const [applications, setApplications] = useState<Application[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all')

  // Drag and Drop state
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ApplicationStatus | null>(null)

  // Tracking action states
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Form state
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus] = useState<ApplicationStatus>('applied')
  const [salary, setSalary] = useState('')
  const [url, setUrl] = useState('')
  const [appliedDate, setAppliedDate] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [searchQuery])

  const loadStats = useCallback(async () => {
    try {
      const statsData = await fetchStats()
      setStats(statsData)
      setStatsError(false)
    } catch {
      setStatsError(true)
    }
  }, [])

  const loadAllData = useCallback(async () => {
    const requestId = ++latestApplicationsRequest.current
    setIsLoading(true)
    setFetchError(null)
    setActionError(null)
    try {
      const [appsData, statsData] = await Promise.all([
        fetchApplications({
          q: debouncedQuery.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        fetchStats().catch(() => null),
      ])
      if (requestId === latestApplicationsRequest.current) {
        setApplications(appsData)
        setStatsError(!statsData)
        if (statsData) setStats(statsData)
      }
    } catch (err) {
      if (requestId === latestApplicationsRequest.current && err instanceof Error) {
        setFetchError(err.message)
      } else if (requestId === latestApplicationsRequest.current) {
        setFetchError('Could not load applications.')
      }
    } finally {
      if (requestId === latestApplicationsRequest.current) setIsLoading(false)
    }
  }, [debouncedQuery, statusFilter])

  // Fetch applications when debounced query or status filter changes
  useEffect(() => {
    let ignore = false
    const requestId = ++latestApplicationsRequest.current

    async function loadFiltered() {
      setIsLoading(true)
      setFetchError(null)
      try {
        const [appsData, statsData] = await Promise.all([
          fetchApplications({
            q: debouncedQuery.trim() || undefined,
            status: statusFilter === 'all' ? undefined : statusFilter,
          }),
          fetchStats().catch(() => null),
        ])
        if (!ignore && requestId === latestApplicationsRequest.current) {
          setApplications(appsData)
          setStatsError(!statsData)
          if (statsData) setStats(statsData)
        }
      } catch (err) {
        if (!ignore && requestId === latestApplicationsRequest.current) {
          setFetchError(
            err instanceof Error ? err.message : 'Could not load applications.',
          )
        }
      } finally {
        if (!ignore && requestId === latestApplicationsRequest.current) {
          setIsLoading(false)
        }
      }
    }

    loadFiltered()

    return () => {
      ignore = true
    }
  }, [debouncedQuery, statusFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!company.trim() || !position.trim()) {
      setFormError('Please enter a company name and job title.')
      return
    }

    setIsSubmitting(true)

    try {
      await createApplication({
        company: company.trim(),
        position: position.trim(),
        status,
        salary: salary.trim() || undefined,
        url: url.trim() || undefined,
        appliedDate: appliedDate || undefined,
        interviewDate: interviewDate || undefined,
        followUpDate: followUpDate || undefined,
        notes: notes.trim() || undefined,
      })

      await loadAllData()

      // Reset form
      setCompany('')
      setPosition('')
      setStatus('applied')
      setSalary('')
      setUrl('')
      setAppliedDate('')
      setInterviewDate('')
      setFollowUpDate('')
      setNotes('')
    } catch (err) {
      if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError('Something went wrong while creating the application.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (id: number, newStatus: ApplicationStatus) => {
    setUpdatingId(id)
    setActionError(null)
    try {
      const updated = await updateApplication(id, { status: newStatus })
      setApplications((prev) => {
        if (statusFilter !== 'all' && updated.status !== statusFilter) {
          return prev.filter((item) => item.id !== id)
        }
        return prev.map((item) => (item.id === id ? updated : item))
      })
      loadStats()
    } catch (err) {
      if (err instanceof Error) {
        setActionError(err.message)
      } else {
        setActionError('Something went wrong while updating the application status.')
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (app: Application) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the application for "${app.position}" at ${app.company}?`,
    )
    if (!confirmed) return

    setDeletingId(app.id)
    setActionError(null)
    try {
      await deleteApplication(app.id)
      setApplications((prev) => prev.filter((item) => item.id !== app.id))
      loadStats()
    } catch (err) {
      if (err instanceof Error) {
        setActionError(err.message)
      } else {
        setActionError('Something went wrong while deleting the application.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  // HTML5 Drag and Drop handler for Kanban
  const handleCardDrop = async (appId: number, targetStatus: ApplicationStatus) => {
    setDraggingId(null)
    setDragOverColumn(null)

    const targetApp = applications.find((a) => a.id === appId)
    if (!targetApp || targetApp.status === targetStatus) {
      return
    }

    const previousStatus = targetApp.status

    // Optimistic update
    setApplications((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, status: targetStatus } : app)),
    )
    setActionError(null)

    try {
      const updated = await updateApplication(appId, { status: targetStatus })
      setApplications((prev) => {
        if (statusFilter !== 'all' && updated.status !== statusFilter) {
          return prev.filter((app) => app.id !== appId)
        }
        return prev.map((app) => (app.id === appId ? updated : app))
      })
      loadStats()
    } catch (err) {
      // Revert to the previous column if the API call fails
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status: previousStatus } : app)),
      )
      if (err instanceof Error) {
        setActionError(`Status update failed: ${err.message}`)
      } else {
        setActionError('Something went wrong while changing the application status.')
      }
    } finally {
      setDraggingId(null)
      setDragOverColumn(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <p className="text-xs text-slate-500" role="status">
            Demo mode: your data is stored only in your browser
          </p>
        )}
        {/* Header */}
        <header className="border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Job Application Tracker
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Track and manage your job applications
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                Total applications: {stats ? stats.total : applications.length}
              </span>
              {statsError && (
                <span className="text-xs text-amber-700" role="status">
                  Could not load statistics
                </span>
              )}
            </div>
          </div>
        </header>

        {/* New application form */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span>➕</span> Add a new application
          </h2>

          {formError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start justify-between gap-2">
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
                title="Dismiss notification"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company name & job title */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">
                  Company <span className="text-rose-500">*</span>
                </label>
                <input
                  id="company"
                  type="text"
                  placeholder="e.g. Google, Acme, Contoso..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-slate-700 mb-1">
                  Job title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="position"
                  type="text"
                  placeholder="e.g. Frontend Engineer, React Developer..."
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Status, salary & job listing link */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="salary" className="block text-sm font-medium text-slate-700 mb-1">
                  Salary (optional)
                </label>
                <input
                  id="salary"
                  type="text"
                  placeholder="e.g. $80,000–$100,000, $1,500/month..."
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-1">
                  Job listing URL
                </label>
                <input
                  id="url"
                  type="url"
                  placeholder="https://company.com/job/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Optional dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="appliedDate" className="block text-sm font-medium text-slate-700 mb-1">
                  Application date
                </label>
                <input
                  id="appliedDate"
                  type="date"
                  value={appliedDate}
                  onChange={(e) => setAppliedDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="interviewDate" className="block text-sm font-medium text-slate-700 mb-1">
                  Interview date
                </label>
                <input
                  id="interviewDate"
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="followUpDate" className="block text-sm font-medium text-slate-700 mb-1">
                  Follow-up date
                </label>
                <input
                  id="followUpDate"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={2}
                placeholder="Interview details, recruiter contact, preparation notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  '+ Add application'
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Search and status filters (apply to both List and Kanban views) */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search field */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.65 5.65a7.5 7.5 0 0010.7 10.7z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company or job title..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Filter by status:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | ApplicationStatus)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* List / Kanban view */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {viewMode === 'list' ? 'Applications' : 'Kanban board'}
              </h2>
              <span className="text-xs text-slate-500">
                (Showing {applications.length} results)
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* View mode toggle */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'kanban'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📊 Kanban
                </button>
              </div>

              {!isLoading && (
                <button
                  type="button"
                  onClick={loadAllData}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  title="Refresh data"
                >
                  🔄 Refresh
                </button>
              )}
            </div>
          </div>

          {/* Action error banner */}
          {actionError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
                title="Dismiss notification"
              >
                ✕
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
                <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Loading data...</span>
              </div>
            </div>
          ) : fetchError ? (
            <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <span>⚠️</span>
                <span>Could not connect to or load data from the API server</span>
              </div>
              <p className="text-rose-600">{fetchError}</p>
              <div>
                <button
                  type="button"
                  onClick={loadAllData}
                  className="inline-flex items-center rounded-md bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            /* List view */
            applications.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <p className="text-slate-500 text-sm">
                  {debouncedQuery || statusFilter !== 'all'
                    ? 'No applications match your filters.'
                    : 'No applications yet. Add your first one!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-semibold text-slate-900">
                          {app.company}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeStyles[app.status]}`}
                        >
                          {statusOptions.find((s) => s.value === app.status)?.label || app.status}
                        </span>

                        {/* Follow-up and interview date labels */}
                        {isFollowUpDue(app.followUpDate) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
                            Follow-up due
                          </span>
                        )}
                        {isUpcomingInterview(app.interviewDate) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                            Upcoming interview
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-slate-600">
                        {app.position}
                      </p>

                      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 pt-0.5">
                        {app.salary && (
                          <span>
                            💰 <span className="font-medium text-slate-700">{app.salary}</span>
                          </span>
                        )}
                        {app.url && (
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline truncate max-w-xs inline-flex items-center gap-1"
                          >
                            🔗 Job listing
                          </a>
                        )}
                      </div>

                      {/* Date details */}
                      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 pt-0.5">
                        {app.appliedDate && (
                          <span>📅 Applied: {app.appliedDate}</span>
                        )}
                        {app.interviewDate && (
                          <span>🗓️ Interview: {app.interviewDate}</span>
                        )}
                        {app.followUpDate && (
                          <span>⏰ Follow-up: {app.followUpDate}</span>
                        )}
                      </div>

                      {app.notes && (
                        <p className="text-xs text-slate-500 italic mt-1">
                          📝 {app.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:items-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {app.createdAt && (
                        <div className="text-xs text-slate-400">
                          Created: {new Date(app.createdAt).toLocaleDateString('en-US')}
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status selector */}
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`status-${app.id}`} className="text-xs text-slate-500 whitespace-nowrap">
                            Status:
                          </label>
                          <select
                            id={`status-${app.id}`}
                            value={app.status}
                            disabled={updatingId === app.id || deletingId === app.id}
                            onChange={(e) =>
                              handleStatusChange(app.id, e.target.value as ApplicationStatus)
                            }
                            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(app)}
                          disabled={deletingId === app.id || updatingId === app.id}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete application"
                        >
                          {deletingId === app.id ? (
                            <>
                              <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-rose-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Kanban view */
            <div className={`flex gap-4 overflow-x-auto pb-4 ${draggingId !== null ? 'select-none' : ''}`}>
              {kanbanColumns.map((col) => {
                const columnApps = applications.filter((app) => app.status === col.status)
                const count = columnApps.length
                const isOver = dragOverColumn === col.status

                return (
                  <div
                    key={col.status}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverColumn !== col.status) {
                        setDragOverColumn(col.status)
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return
                      if (dragOverColumn === col.status) {
                        setDragOverColumn(null)
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDraggingId(null)
                      setDragOverColumn(null)
                      const idStr = e.dataTransfer.getData('text/plain')
                      const appId = Number(idStr)
                      if (appId) {
                        handleCardDrop(appId, col.status)
                      }
                    }}
                    className={`flex-1 min-w-[220px] rounded-xl p-3 bg-slate-100 flex flex-col gap-3 min-h-[420px] transition-all border-2 ${
                      draggingId !== null ? 'select-none' : ''
                    } ${
                      isOver
                        ? 'border-blue-500 bg-blue-50/70 shadow-inner'
                        : 'border-transparent'
                    }`}
                  >
                    {/* Column heading & application count */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <h3 className={`font-semibold text-sm ${col.headerColor}`}>
                        {col.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.badgeBg} ${col.badgeText}`}
                        title={`Number of ${col.title} applications`}
                      >
                        {count}
                      </span>
                    </div>

                    {/* Application cards */}
                    <div className="flex-1 flex flex-col gap-2.5">
                      {columnApps.length === 0 ? (
                        <div className="h-24 flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                          Drag and drop here
                        </div>
                      ) : (
                        columnApps.map((app) => (
                          <div
                            key={app.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(app.id))
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggingId(app.id)
                            }}
                            onDragEnd={() => {
                              setDraggingId(null)
                              setDragOverColumn(null)
                            }}
                            className={`bg-white rounded-lg p-3.5 shadow-sm border border-slate-200 transition-all cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow ${
                              draggingId !== null ? 'select-none' : ''
                            } ${
                              draggingId === app.id
                                ? 'opacity-40 ring-2 ring-blue-400'
                                : ''
                            }`}
                          >
                            <h4 className="font-semibold text-sm text-slate-900 leading-snug">
                              {app.company}
                            </h4>
                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                              {app.position}
                            </p>

                            {/* Follow-up and interview date labels */}
                            {(isFollowUpDue(app.followUpDate) || isUpcomingInterview(app.interviewDate)) && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                {isFollowUpDue(app.followUpDate) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-800 border border-orange-300">
                                    Follow-up due
                                  </span>
                                )}
                                {isUpcomingInterview(app.interviewDate) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    Upcoming interview
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Quick details */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                              {app.salary && <div>💰 {app.salary}</div>}
                              {app.url && (
                                <div>
                                  <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 hover:text-blue-800 underline truncate block"
                                  >
                                    🔗 Job listing
                                  </a>
                                </div>
                              )}
                              {app.interviewDate && (
                                <div>🗓️ Interview: {app.interviewDate}</div>
                              )}
                              {app.followUpDate && (
                                <div>⏰ Follow-up: {app.followUpDate}</div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default App
