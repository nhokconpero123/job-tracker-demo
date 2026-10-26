import type {
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
  Stats,
  FetchApplicationsParams,
} from '../types/application'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '')
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const DEMO_STORAGE_KEY = 'job-tracker-demo-applications'
const DEMO_NEXT_ID_KEY = 'job-tracker-demo-next-id'
let memoryApplications: Application[] | null = null
let memoryNextId: number | null = null

function demoSeed(): Application[] {
  const today = new Date()
  const date = (days: number) => {
    const value = new Date(today)
    value.setDate(value.getDate() + days)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const now = new Date().toISOString()
  return [
    { id: 1, company: 'Northstar Labs', position: 'Frontend Developer', status: 'wishlist', createdAt: now, updatedAt: now },
    { id: 2, company: 'Bluebird Health', position: 'React Engineer', status: 'applied', appliedDate: date(-5), followUpDate: date(0), createdAt: now, updatedAt: now },
    { id: 3, company: 'Juniper Studio', position: 'UI Engineer', status: 'interview', interviewDate: date(3), createdAt: now, updatedAt: now },
    { id: 4, company: 'Copperfield', position: 'Product Engineer', status: 'offer', createdAt: now, updatedAt: now },
    { id: 5, company: 'Mosaic Systems', position: 'Software Developer', status: 'rejected', createdAt: now, updatedAt: now },
    { id: 6, company: 'Cedar Analytics', position: 'Full Stack Developer', status: 'applied', appliedDate: date(-2), createdAt: now, updatedAt: now },
  ]
}

function readDemoApplications(): Application[] {
  try {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY)
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed)) return (memoryApplications = parsed as Application[])
    }
    const seeded = demoSeed()
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seeded))
    return (memoryApplications = seeded)
  } catch {
    if (memoryApplications === null) memoryApplications = demoSeed()
    return memoryApplications
  }
}

function writeDemoApplications(applications: Application[]): void {
  memoryApplications = applications
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(applications))
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}

function nextDemoId(applications: Application[]): number {
  const minimum = applications.reduce((max, app) => Math.max(max, app.id), 0) + 1
  let nextId = Math.max(memoryNextId ?? minimum, minimum)
  try {
    const storedNextId = Number(window.localStorage.getItem(DEMO_NEXT_ID_KEY))
    if (Number.isInteger(storedNextId) && storedNextId > 0) nextId = Math.max(nextId, storedNextId)
    window.localStorage.setItem(DEMO_NEXT_ID_KEY, String(nextId + 1))
  } catch {
    // The in-memory counter still increases for this session.
  }
  memoryNextId = nextId + 1
  return nextId
}

function demoStats(applications: Application[]): Stats {
  const byStatus: Stats['byStatus'] = { wishlist: 0, applied: 0, interview: 0, offer: 0, rejected: 0 }
  applications.forEach((application) => { byStatus[application.status] += 1 })
  return { total: applications.length, byStatus }
}

export function resetDemoData(): void {
  if (!DEMO_MODE) return
  memoryApplications = null
  memoryNextId = null
  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY)
    window.localStorage.removeItem(DEMO_NEXT_ID_KEY)
  } catch {
    // Reset the in-memory demo data even when browser storage is unavailable.
  }
  readDemoApplications()
}

export async function fetchApplications(params?: FetchApplicationsParams): Promise<Application[]> {
  if (DEMO_MODE) {
    const q = params?.q?.trim().toLocaleLowerCase()
    return readDemoApplications().filter((application) =>
      (!params?.status || application.status === params.status) &&
      (!q || application.company.toLocaleLowerCase().includes(q) || application.position.toLocaleLowerCase().includes(q)),
    )
  }
  const query = new URLSearchParams()
  if (params?.status) {
    query.set('status', params.status)
  }
  if (params?.q && params.q.trim()) {
    query.set('q', params.q.trim())
  }
  const queryString = query.toString()
  const endpoint = `${API_BASE_URL}/applications${queryString ? `?${queryString}` : ''}`

  let res: Response
  try {
    res = await fetch(endpoint)
  } catch {
    throw new Error(
      `Could not connect to the backend server (${API_BASE_URL}). Please make sure the backend is running.`,
    )
  }

  if (!res.ok) {
    let message = `Server error (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ignore if the response is not JSON
    }
    throw new Error(message)
  }

  return res.json()
}

export async function fetchStats(): Promise<Stats> {
  if (DEMO_MODE) return demoStats(readDemoApplications())
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/stats`)
  } catch {
    throw new Error(
      `Could not connect to the backend server (${API_BASE_URL}). Please make sure the backend is running.`,
    )
  }

  if (!res.ok) {
    let message = `Server error (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ignore if the response is not JSON
    }
    throw new Error(message)
  }

  return res.json()
}

export async function createApplication(input: CreateApplicationInput): Promise<Application> {
  if (DEMO_MODE) {
    const applications = readDemoApplications()
    const now = new Date().toISOString()
    const created: Application = { ...input, id: nextDemoId(applications), createdAt: now, updatedAt: now }
    writeDemoApplications([created, ...applications])
    return created
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(
      `Could not connect to the backend server (${API_BASE_URL}). Please make sure the backend is running.`,
    )
  }

  if (!res.ok) {
    let message = `Failed to create application (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ignore if the response is not JSON
    }
    throw new Error(message)
  }

  return res.json()
}

export async function updateApplication(
  id: number,
  updates: UpdateApplicationInput,
): Promise<Application> {
  if (DEMO_MODE) {
    const applications = readDemoApplications()
    const index = applications.findIndex((application) => application.id === id)
    if (index < 0) throw new Error('Application not found')
    const updated = { ...applications[index], ...updates, updatedAt: new Date().toISOString() }
    applications[index] = updated
    writeDemoApplications(applications)
    return updated
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/applications/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })
  } catch {
    throw new Error(
      `Could not connect to the backend server (${API_BASE_URL}). Please make sure the backend is running.`,
    )
  }

  if (!res.ok) {
    let message = `Failed to update application status (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ignore if the response is not JSON
    }
    throw new Error(message)
  }

  return res.json()
}

export async function deleteApplication(id: number): Promise<void> {
  if (DEMO_MODE) {
    const applications = readDemoApplications()
    if (!applications.some((application) => application.id === id)) throw new Error('Application not found')
    writeDemoApplications(applications.filter((application) => application.id !== id))
    return
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/applications/${id}`, {
      method: 'DELETE',
    })
  } catch {
    throw new Error(
      `Could not connect to the backend server (${API_BASE_URL}). Please make sure the backend is running.`,
    )
  }

  if (!res.ok) {
    let message = `Failed to delete application (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ignore if the response is not JSON
    }
    throw new Error(message)
  }
}
