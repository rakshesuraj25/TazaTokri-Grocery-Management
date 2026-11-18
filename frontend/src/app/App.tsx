import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { Providers } from './providers'
import { useMe } from '@/features/auth/hooks'

function SessionRestore() {
  useMe()
  return null
}

export function App() {
  return (
    <Providers>
      <SessionRestore />
      <RouterProvider router={router} />
    </Providers>
  )
}
