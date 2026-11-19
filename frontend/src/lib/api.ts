/**
 * Centralized API client.
 * - Base URL from VITE_API_URL
 * - Attaches Authorization: Bearer <token>
 * - Parses errors into ApiError
 * - On 401: triggers auth logout via event
 */

export interface ApiError {
  status: number
  message: string
  fieldErrors?: Record<string, string>
}

export class ApiRequestError extends Error {
  constructor(
    public readonly apiError: ApiError,
  ) {
    super(apiError.message)
    this.name = 'ApiRequestError'
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function parseErrorBody(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`
  let fieldErrors: Record<string, string> | undefined

  try {
    const body = await res.json() as { message?: string; errors?: Record<string, string> }
    message = body.message ?? message
    if (body.errors) fieldErrors = body.errors
  } catch {
    // ignore JSON parse errors
  }

  return { status: res.status, message, fieldErrors }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { public?: boolean } = {},
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (!options.public) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Network failure / server down / CORS: status 0 lets the UI show "no connection"
    throw new ApiRequestError({ status: 0, message: 'Network error' })
  }

  if (res.status === 401) {
    // Public endpoints (e.g. login with a wrong password) must NOT end the session
    if (!options.public) window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    const err = await parseErrorBody(res)
    throw new ApiRequestError(err)
  }

  if (!res.ok) {
    const err = await parseErrorBody(res)
    throw new ApiRequestError(err)
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Narrow an unknown error to ApiError (or a generic one). */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiRequestError) return err.apiError
  return { status: -1, message: err instanceof Error ? err.message : String(err) }
}

export const api = {
  get: <T>(path: string, opts?: { public?: boolean }) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: { public?: boolean }) =>
    request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
