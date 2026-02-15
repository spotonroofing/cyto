/**
 * Date arithmetic utilities for timeline intelligence.
 * All dates are ISO strings (YYYY-MM-DD).
 */

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

export function diffDays(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function today(): string {
  return new Date().toISOString().split('T')[0]!
}

export function isOverdue(dueDate: string): boolean {
  return dueDate < today()
}

export function daysSinceOverdue(dueDate: string): number {
  return diffDays(dueDate, today())
}
