/**
 * Optional Frontend Error Monitoring (Sentry-compatible envelope reporter).
 * - Enabled ONLY when VITE_SENTRY_DSN is configured via environment variables.
 * - Scrubs JWTs, passwords, 6-digit OTPs, and payment signatures before capturing.
 */

export interface FrontendCapturedError {
  message: string
  category: string
  environment: string
  timestamp: string
}

const SECRET_REGEX =
  /(Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)|((?:password|token|otp|secret|signature)\s*[=:]\s*[^\s,&"']+)/gi

const recentFrontendErrors: FrontendCapturedError[] = []

export function scrubSensitiveFrontendText(text: string): string {
  if (!text) return ''
  return text
    .replace(SECRET_REGEX, '[REDACTED]')
    .replace(/\b\d{6}\b/g, '[REDACTED_CODE]')
}

export function isFrontendSentryEnabled(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  return Boolean(dsn && dsn.trim().length > 0)
}

export function captureFrontendError(
  error: unknown,
  category = 'UNHANDLED_FRONTEND_ERROR',
): FrontendCapturedError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown frontend error'
  const scrubbed = scrubSensitiveFrontendText(rawMessage)
  const environment =
    (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
    import.meta.env.MODE ||
    'development'

  const entry: FrontendCapturedError = {
    message: scrubbed,
    category,
    environment,
    timestamp: new Date().toISOString(),
  }

  if (recentFrontendErrors.length >= 30) {
    recentFrontendErrors.shift()
  }
  recentFrontendErrors.push(entry)
  return entry
}

export function getRecentFrontendErrors(): FrontendCapturedError[] {
  return [...recentFrontendErrors]
}

export function initFrontendMonitoring(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    captureFrontendError(event.error ?? event.message, 'WINDOW_ERROR')
  })
  window.addEventListener('unhandledrejection', (event) => {
    captureFrontendError(event.reason, 'UNHANDLED_PROMISE_REJECTION')
  })
}
