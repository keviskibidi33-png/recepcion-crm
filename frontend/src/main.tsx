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
const CRM_LOGIN_URL = import.meta.env.VITE_CRM_LOGIN_URL || 'http://localhost:3000/login'

const AccessGate = ({ children }: { children: React.ReactNode }) => {
    const [searchParams] = useSearchParams();
    const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        if (tokenFromUrl) {
            localStorage.setItem('token', tokenFromUrl);
        }

        const token = tokenFromUrl || localStorage.getItem('token');
        const isEmbedded = window.parent !== window;
        const authorized = !!tokenFromUrl || (isEmbedded && !!token);
        setIsAuthorized(authorized);
    }, [searchParams]);

    if (isAuthorized === null) return null;

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
                    <h1 className="text-xl font-semibold text-slate-900">Acceso restringido</h1>
                    <p className="text-slate-600 mt-3">
                        Debes ingresar desde el CRM para obtener una sesión válida.
                    </p>
                    <button
                        className="mt-5 w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800"
                        onClick={() => window.location.assign(CRM_LOGIN_URL)}
                    >
                        Ir al login del CRM
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AccessGate>
                    <SessionGuard />
                    <Routes>
                        <Route path="/" element={<Navigate to="/migration" replace />} />
                        <Route path="/migration" element={<RecepcionModule />} />
                        <Route path="/migration/nueva-recepcion" element={<OrdenForm />} />
                        <Route path="/migration/recepciones/:id" element={<OrdenDetail />} />
                        <Route path="/migration/recepciones/:id/editar" element={<OrdenForm />} />
                    </Routes>
                </AccessGate>
            </BrowserRouter>
            <Toaster position="top-right" />
        </QueryClientProvider>
    </React.StrictMode>,
)
