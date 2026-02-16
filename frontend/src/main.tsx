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
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
                <div className="w-full max-w-md">
                    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
                        {/* Logo / Icon */}
                        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                <circle cx="12" cy="16" r="1" fill="currentColor" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
                            Acceso Restringido
                        </h1>
                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            Este módulo requiere una sesión activa del CRM.<br />
                            Inicia sesión para continuar.
                        </p>

                        {/* Divider */}
                        <div className="h-px bg-white/10 mb-8" />

                        {/* CTA Button */}
                        <button
                            className="w-full py-3 px-6 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                            onClick={() => window.location.assign(CRM_LOGIN_URL)}
                        >
                            Iniciar sesión en el CRM
                        </button>

                        {/* Footer */}
                        <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                            GEO-FAL &middot; Sistema de Gestión
                        </p>
                    </div>
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
