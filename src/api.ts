import type { EarnedValueDocument, EarnedValueWeek, Plan } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `Error ${response.status}`)
  }
  return body as T
}

export function fetchPlan(): Promise<Plan> {
  return request<Plan>('/api/plan')
}

export function savePlan(plan: Plan): Promise<{ savedAt: string }> {
  return request<{ savedAt: string }>('/api/plan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  })
}

export async function fetchPrototypeFiles(): Promise<string[]> {
  const { files } = await request<{ files: string[] }>('/api/prototype-files')
  return files
}

export function fetchEarnedValue(): Promise<EarnedValueDocument> {
  return request<EarnedValueDocument>('/api/earned-value')
}

export function saveEarnedValue(weeks: EarnedValueWeek[]): Promise<{ savedAt: string }> {
  return request<{ savedAt: string }>('/api/earned-value', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeks }),
  })
}
