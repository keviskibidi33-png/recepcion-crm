import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from 'react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import RecepcionModule from './pages/RecepcionModule'
import OrdenForm from './pages/OrdenForm'
import OrdenDetail from './pages/OrdenDetail'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
