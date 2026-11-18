import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { useAuthStore } from './features/auth/store'
import { queryClient } from './app/providers'
import './i18n/index'
import './styles/globals.css'

/**
 * Global 401 handler: the API client dispatches `auth:unauthorized`.
 * Clear the whole session (token + persisted user + cached queries)
 * and send the user to login with a "session expired" hint.
 */
window.addEventListener('auth:unauthorized', () => {
  const wasLoggedIn = !!useAuthStore.getState().user
  useAuthStore.getState().logout()
  queryClient.clear()
  if (wasLoggedIn && !window.location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(window.location.pathname)
    window.location.assign(`/login?expired=1&next=${next}`)
  }
})

async function prepare() {
  // MSW mocks ONLY when VITE_USE_MOCKS=true (default false).
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }
}

void prepare().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
