import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg3)',
            color: 'var(--text)',
            border: '1px solid var(--border2)',
            fontFamily: 'var(--font)',
            fontSize: '13px',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: 'var(--green)', secondary: 'transparent' } },
          error:   { iconTheme: { primary: 'var(--red)',   secondary: 'transparent' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
