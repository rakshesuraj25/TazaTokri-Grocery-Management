/**
 * Date/time helpers scoped to Asia/Kolkata timezone.
 */
import { format, parseISO, isToday, isSameDay } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

const IST = 'Asia/Kolkata'

/** Get today's date string in YYYY-MM-DD format (IST). */
export function todayIST(): string {
  return formatInTimeZone(new Date(), IST, 'yyyy-MM-dd')
}

/** Format a date string or Date to a human-readable IST date. */
export function fmtDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(d, IST, 'dd MMM yyyy')
}

/** Format an ISO datetime to IST time. */
export function fmtTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(d, IST, 'h:mm a')
}

/** Format an ISO datetime to full IST datetime. */
export function fmtDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(d, IST, 'dd MMM yyyy, h:mm a')
}

/** Check if an ISO datetime is today in IST. */
export function isDateToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  const ist = toZonedTime(d, IST)
  return isToday(ist)
}

/** Format as YYYY-MM-DD for API calls. */
export function toApiDate(date: Date): string {
  return formatInTimeZone(date, IST, 'yyyy-MM-dd')
}

/** Check if two dates are the same day in IST. */
export function isSameDayIST(a: Date, b: Date): boolean {
  return isSameDay(toZonedTime(a, IST), toZonedTime(b, IST))
}

/** Get current IST hour (0-23) for cutoff checks. */
export function currentHourIST(now: Date = new Date()): number {
  return Number(formatInTimeZone(now, IST, 'H'))
}

/** Format duration in seconds as mm:ss countdown. */
export function fmtCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export { format, parseISO }
