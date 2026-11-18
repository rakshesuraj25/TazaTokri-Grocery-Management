import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: (failureCount, error) => {
        // Don't retry 401/403/404
        const status = (error as { apiError?: { status: number } }).apiError?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
    },
    mutations: {
      onError: (error) => {
        // Global mutation error logging (UI shows errors from hooks)
        console.error('[mutation error]', error)
      },
    },
  },
})

// eslint-disable-next-line react-refresh/only-export-components
export { queryClient }

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>
        {children}
      </TooltipProvider>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          duration: 4000,
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
