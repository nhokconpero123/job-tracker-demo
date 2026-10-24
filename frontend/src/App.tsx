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
  { value: 'wishlist', label: 'Wishlist (Quan tâm)' },
  { value: 'applied', label: 'Applied (Đã ứng tuyển)' },
  { value: 'interview', label: 'Interview (Phỏng vấn)' },
  { value: 'offer', label: 'Offer (Nhận đề nghị)' },
  { value: 'rejected', label: 'Rejected (Đã từ chối)' },
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
        setFetchError('Không thể tải danh sách đơn ứng tuyển.')
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
            err instanceof Error ? err.message : 'Không thể tải danh sách đơn ứng tuyển.',
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
      setFormError('Vui lòng nhập tên công ty và vị trí ứng tuyển.')
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
        setFormError('Có lỗi xảy ra khi tạo đơn ứng tuyển.')
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
        setActionError('Có lỗi xảy ra khi cập nhật trạng thái đơn ứng tuyển.')
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (app: Application) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xoá đơn ứng tuyển tại "${app.company}" (${app.position}) không?`,
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
        setActionError('Có lỗi xảy ra khi xoá đơn ứng tuyển.')
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
      // Revert về cột cũ khi gọi API thất bại
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status: previousStatus } : app)),
      )
      if (err instanceof Error) {
        setActionError(`Chuyển trạng thái thất bại: ${err.message}`)
      } else {
        setActionError('Có lỗi xảy ra khi chuyển trạng thái đơn ứng tuyển.')
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
            Chế độ demo: dữ liệu chỉ lưu trong trình duyệt của bạn
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
                Theo dõi và quản lý quá trình ứng tuyển công việc
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                Tổng số: {stats ? stats.total : applications.length} đơn
              </span>
              {statsError && (
                <span className="text-xs text-amber-700" role="status">
                  Không tải được thống kê
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Form thêm đơn mới */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span>➕</span> Thêm đơn ứng tuyển mới
          </h2>

          {formError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start justify-between gap-2">
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
                title="Đóng thông báo"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tên công ty & Vị trí ứng tuyển */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">
                  Công ty <span className="text-rose-500">*</span>
                </label>
                <input
                  id="company"
                  type="text"
                  placeholder="Ví dụ: Google, VNG, Viettel..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-slate-700 mb-1">
                  Vị trí ứng tuyển <span className="text-rose-500">*</span>
                </label>
                <input
                  id="position"
                  type="text"
                  placeholder="Ví dụ: Frontend Engineer, React Dev..."
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Trạng thái, Mức lương & Link tin tuyển dụng */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                  Trạng thái <span className="text-rose-500">*</span>
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
                  Mức lương (tùy chọn)
                </label>
                <input
                  id="salary"
                  type="text"
                  placeholder="Ví dụ: 20-30tr, $1500..."
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-1">
                  Link tin tuyển dụng (url)
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

            {/* Các trường ngày tùy chọn */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="appliedDate" className="block text-sm font-medium text-slate-700 mb-1">
                  Ngày nộp (appliedDate)
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
                  Ngày phỏng vấn (interviewDate)
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
                  Ngày follow-up (followUpDate)
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

            {/* Ghi chú */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                Ghi chú (tùy chọn)
              </label>
              <textarea
                id="notes"
                rows={2}
                placeholder="Ghi chú về vòng phỏng vấn, liên hệ HR, chuẩn bị kỹ năng..."
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
                    Đang lưu...
                  </>
                ) : (
                  '+ Thêm đơn ứng tuyển'
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Thanh tìm kiếm & Bộ lọc trạng thái (áp dụng cho cả Danh sách và Kanban) */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Ô tìm kiếm */}
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
                placeholder="Tìm kiếm theo công ty hoặc vị trí..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xoá tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Bộ lọc theo trạng thái */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Lọc trạng thái:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | ApplicationStatus)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="all">Tất cả trạng thái</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Phần hiển thị danh sách / Kanban */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {viewMode === 'list' ? 'Danh sách đơn ứng tuyển' : 'Bảng Kanban'}
              </h2>
              <span className="text-xs text-slate-500">
                (Hiển thị {applications.length} kết quả)
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Nút chuyển đổi chế độ xem */}
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
                  📋 Danh sách
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
                  title="Tải lại dữ liệu"
                >
                  🔄 Tải lại
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
                title="Đóng thông báo"
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
                <span>Đang tải dữ liệu...</span>
              </div>
            </div>
          ) : fetchError ? (
            <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <span>⚠️</span>
                <span>Không thể kết nối hoặc tải dữ liệu từ máy chủ API</span>
              </div>
              <p className="text-rose-600">{fetchError}</p>
              <div>
                <button
                  type="button"
                  onClick={loadAllData}
                  className="inline-flex items-center rounded-md bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            /* Chế độ xem DANH SÁCH */
            applications.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <p className="text-slate-500 text-sm">
                  {debouncedQuery || statusFilter !== 'all'
                    ? 'Không tìm thấy đơn ứng tuyển nào phù hợp với bộ lọc.'
                    : 'Chưa có đơn ứng tuyển nào. Hãy thêm đơn đầu tiên!'}
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

                        {/* Nhãn theo ngày follow-up và interview */}
                        {isFollowUpDue(app.followUpDate) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
                            Cần follow-up
                          </span>
                        )}
                        {isUpcomingInterview(app.interviewDate) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                            Phỏng vấn sắp tới
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
                            🔗 Link tuyển dụng
                          </a>
                        )}
                      </div>

                      {/* Thông tin ngày tháng */}
                      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 pt-0.5">
                        {app.appliedDate && (
                          <span>📅 Ngày nộp: {app.appliedDate}</span>
                        )}
                        {app.interviewDate && (
                          <span>🗓️ Phỏng vấn: {app.interviewDate}</span>
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
                          Ngày tạo: {new Date(app.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Ô chọn đổi trạng thái */}
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`status-${app.id}`} className="text-xs text-slate-500 whitespace-nowrap">
                            Trạng thái:
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

                        {/* Nút xoá */}
                        <button
                          type="button"
                          onClick={() => handleDelete(app)}
                          disabled={deletingId === app.id || updatingId === app.id}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Xoá đơn ứng tuyển"
                        >
                          {deletingId === app.id ? (
                            <>
                              <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-rose-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              Đang xoá...
                            </>
                          ) : (
                            'Xoá'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Chế độ xem KANBAN */
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
                    {/* Tiêu đề cột & số lượng đơn */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <h3 className={`font-semibold text-sm ${col.headerColor}`}>
                        {col.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.badgeBg} ${col.badgeText}`}
                        title={`Số lượng đơn trạng thái ${col.title}`}
                      >
                        {count}
                      </span>
                    </div>

                    {/* Danh sách thẻ đơn ứng tuyển */}
                    <div className="flex-1 flex flex-col gap-2.5">
                      {columnApps.length === 0 ? (
                        <div className="h-24 flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                          Kéo thả vào đây
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

                            {/* Nhãn theo ngày follow-up và interview */}
                            {(isFollowUpDue(app.followUpDate) || isUpcomingInterview(app.interviewDate)) && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                {isFollowUpDue(app.followUpDate) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-800 border border-orange-300">
                                    Cần follow-up
                                  </span>
                                )}
                                {isUpcomingInterview(app.interviewDate) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    Phỏng vấn sắp tới
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Thông tin phụ ngắn gọn */}
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
                                    🔗 Tin tuyển dụng
                                  </a>
                                </div>
                              )}
                              {app.interviewDate && (
                                <div>🗓️ PV: {app.interviewDate}</div>
                              )}
                              {app.followUpDate && (
                                <div>⏰ F/U: {app.followUpDate}</div>
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
