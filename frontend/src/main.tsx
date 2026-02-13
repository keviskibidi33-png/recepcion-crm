import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from 'react-query'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import RecepcionModule from './pages/RecepcionModule'
import OrdenForm from './pages/OrdenForm'
import OrdenDetail from './pages/OrdenDetail'
import { SessionGuard } from './components/SessionGuard'
import './index.css'

const queryClient = new QueryClient()

// Capture auth token from URL (passed by CRM shell) and persist it
const TokenHandler = () => {
    const [searchParams] = useSearchParams();
    React.useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            console.log('[TokenHandler] Token received from CRM, saving to localStorage');
            localStorage.setItem('token', token);
        }
    }, [searchParams]);
    return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <TokenHandler />
                <SessionGuard />
                <Routes>
                    <Route path="/" element={<Navigate to="/migration" replace />} />
                    <Route path="/migration" element={<RecepcionModule />} />
                    <Route path="/migration/nueva-recepcion" element={<OrdenForm />} />
                    <Route path="/migration/recepciones/:id" element={<OrdenDetail />} />
                    <Route path="/migration/recepciones/:id/editar" element={<OrdenForm />} />
                </Routes>
            </BrowserRouter>
            <Toaster position="top-right" />
        </QueryClientProvider>
    </React.StrictMode>,
)
