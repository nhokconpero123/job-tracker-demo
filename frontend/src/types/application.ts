export type ApplicationStatus = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface Application {
  id: number
  company: string
  position: string
  url?: string
  salary?: string
  status: ApplicationStatus
  appliedDate?: string
  interviewDate?: string
  followUpDate?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export type CreateApplicationInput = Omit<Application, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateApplicationInput = Partial<CreateApplicationInput>

export interface Stats {
  total: number
  byStatus: Record<ApplicationStatus, number>
}

export interface FetchApplicationsParams {
  q?: string
  status?: ApplicationStatus
}
