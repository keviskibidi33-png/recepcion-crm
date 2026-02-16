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
            <div className="min-h-screen flex flex-col bg-white">
                {/* Main Content */}
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-sm text-center">
                        {/* Logo */}
                        <div className="mb-8">
                            <img src="/geofal.svg" alt="Geofal" className="h-14 mx-auto" style={{ filter: 'grayscale(100%) contrast(1.2)' }} />
                        </div>

                        {/* Lock Icon */}
                        <div className="mx-auto w-12 h-12 border-2 border-black rounded-full flex items-center justify-center mb-6">
                            <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h1 className="text-xl font-bold text-black tracking-wide uppercase mb-3">
                            Acceso Denegado
                        </h1>

                        {/* Audit Notice */}
                        <p className="text-xs text-neutral-500 leading-relaxed mb-8">
                            Todos los intentos de acceso son registrados y auditados.<br />
                            Se requiere autenticación válida desde el CRM.
                        </p>

                        {/* CTA Button */}
                        <button
                            className="w-full py-3 px-6 bg-black text-white text-sm font-semibold tracking-wide uppercase hover:bg-neutral-800 active:bg-neutral-900 transition-colors"
                            onClick={() => window.location.assign(CRM_LOGIN_URL)}
                        >
                            Ir al CRM
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <footer className="py-4 border-t border-neutral-200 text-center">
                    <div className="flex items-center justify-center gap-4 text-[10px] text-neutral-400 uppercase tracking-widest">
                        <span>Términos</span>
                        <span>&middot;</span>
                        <span>Licencias</span>
                        <span>&middot;</span>
                        <span>Privacidad</span>
                    </div>
                    <p className="text-[9px] text-neutral-300 mt-2 tracking-widest uppercase">
                        &copy; {new Date().getFullYear()} Geofal S.A.S &mdash; Sistema auditado
                    </p>
                </footer>
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
