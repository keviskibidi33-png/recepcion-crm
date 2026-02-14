import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import {
    ChevronLeft,
    FileSpreadsheet,
    Pencil,
    Trash2,
    Printer,
    Calendar,
    MapPin,
    User,
    CheckCircle2,
    Clock,
    FileText,
    Download,
    Building2,
    Mail,
    Phone
} from 'lucide-react'
import { recepcionApi } from '../services/recepcionApi'
import toast from 'react-hot-toast'

export default function OrdenDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [isDownloading, setIsDownloading] = useState(false)

    const { data: orden, isLoading, error } = useQuery(
        ['recepcion-migration', id],
        () => recepcionApi.obtener(Number(id)),
        {
            enabled: !!id,
            onError: (error: any) => {
                toast.error(`Error cargando recepción: ${error.message}`)
            }
        }
    )

    const handleDownloadExcel = async () => {
        if (!orden || !orden.id) return
        setIsDownloading(true)
        try {
            await recepcionApi.descargarExcel(orden.id, orden.numero_ot)
            toast.success('Excel descargado correctamente')
        } catch (error: any) {
            toast.error(`Error: ${error.message}`)
        } finally {
            setIsDownloading(false)
        }
    }

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
    )

    if (error || !orden) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center bg-card p-10 rounded-3xl border border-destructive/20 shadow-xl max-w-md">
                <div className="bg-destructive/10 text-destructive h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trash2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Error al cargar datos</h2>
                <p className="text-muted-foreground mb-6">No pudimos encontrar la recepción solicitada o hubo un problema de conexión.</p>
                <button onClick={() => navigate('/migration')} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:bg-primary/90">
                    Volver al Listado
                </button>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans antialiased text-slate-900">
            {/* Soft Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/migration')}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-[#003366] uppercase tracking-tight">OT: {orden.numero_ot}</h1>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${orden.estado === 'COMPLETADA'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                                    }`}>
                                    {orden.estado}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">Recepción: {orden.numero_recepcion}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownloadExcel}
                            disabled={isDownloading}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#003366] hover:bg-slate-50 transition-all disabled:opacity-50 shadow-sm"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-[#107C41]" />
                            {isDownloading ? 'Generando...' : 'Exportar Excel'}
                        </button>
                        <button
                            onClick={() => navigate(`/migration/recepciones/${orden.id}/editar`)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#003366] text-white rounded-xl text-xs font-bold hover:bg-[#002244] transition-all shadow-md shadow-blue-900/10"
                        >
                            <Pencil className="h-4 w-4" />
                            Editar
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8 overflow-y-auto max-h-[calc(100vh-80px)] scrollbar-thin scrollbar-thumb-slate-200">
                {/* Information Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Client Info */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-8 space-y-8">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Proyecto & Ubicación</h3>
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2 uppercase">{orden.proyecto}</h2>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <MapPin className="h-4 w-4 text-[#003366]" />
                                        <span className="text-sm font-bold text-slate-800">{orden.ubicacion}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-slate-100">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Building2 className="h-3 w-3" /> Datos de Facturación
                                        </h4>
                                        <div className="space-y-1.5">
                                            <p className="text-sm font-black text-slate-900 uppercase">{orden.cliente}</p>
                                            <p className="text-xs font-bold text-slate-700 uppercase">RUC: {orden.ruc}</p>
                                            <p className="text-xs font-bold text-slate-700 uppercase leading-relaxed">{orden.domicilio_legal}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <User className="h-3 w-3" /> Contacto Principal
                                        </h4>
                                        <div className="space-y-3">
                                            <p className="text-sm font-black text-slate-900 uppercase">{orden.persona_contacto}</p>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-start gap-2 text-xs font-bold text-slate-700 uppercase">
                                                    <Mail className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                                                    <span className="whitespace-pre-wrap break-all">{(orden.email || '').split(/[\s,;]+/).filter(Boolean).join('\n')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                                                    <Phone className="h-3 w-3 text-slate-400" /> {orden.telefono}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Samples List */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-[#003366]" />
                                    <h3 className="font-black text-slate-900 uppercase tracking-tight">Muestras Registradas ({orden.muestras?.length})</h3>
                                </div>
                            </div>
                            <div className="overflow-x-auto max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-600 border-b border-slate-100 sticky top-0 bg-white z-10">
                                            <th className="px-4 py-4 w-12 text-center">N°</th>
                                            <th className="px-4 py-4">Código LEM</th>
                                            <th className="px-4 py-4">Código</th>
                                            <th className="px-4 py-4">Estructura</th>
                                            <th className="px-4 py-4 text-center">F'c</th>
                                            <th className="px-4 py-4 text-center">Fecha Moldeo</th>
                                            <th className="px-4 py-4 text-center">Hora</th>
                                            <th className="px-4 py-4 text-center">Edad</th>
                                            <th className="px-4 py-4 text-center">Fecha Rotura</th>
                                            <th className="px-4 py-4 text-center">Densidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {orden.muestras?.map((muestra, idx) => (
                                            <tr key={muestra.id} className="hover:bg-blue-50/20 transition-colors group">
                                                <td className="px-4 py-3 text-xs font-black text-slate-500 text-center">{idx + 1}</td>
                                                <td className="px-4 py-3 text-xs font-black text-blue-600 uppercase">{muestra.codigo_muestra_lem || '-'}</td>
                                                <td className="px-4 py-3 text-xs font-black text-slate-900 uppercase whitespace-pre-wrap">{muestra.identificacion_muestra}</td>
                                                <td className="px-4 py-3 text-xs text-slate-700 font-bold uppercase whitespace-pre-wrap">{muestra.estructura}</td>
                                                <td className="px-4 py-3 text-xs text-center">
                                                    <span className="font-black text-amber-600">{muestra.fc_kg_cm2}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-center font-bold text-slate-700">{muestra.fecha_moldeo || '-'}</td>
                                                <td className="px-4 py-3 text-xs text-center font-bold text-slate-500">{muestra.hora_moldeo || '-'}</td>
                                                <td className="px-4 py-3 text-xs text-center font-black text-slate-700">{muestra.edad || '-'}</td>
                                                <td className="px-4 py-3 text-xs text-center font-bold text-slate-700">{muestra.fecha_rotura || '-'}</td>
                                                <td className="px-4 py-3 text-xs text-center font-black uppercase text-slate-500">{muestra.requiere_densidad ? 'SÍ' : 'NO'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar: Details & Logistics */}
                    <div className="space-y-8">
                        {/* Status Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Estado del Trabajo</h3>
                            <div className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                                {orden.estado === 'COMPLETADA' ? (
                                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                                ) : (
                                    <Clock className="h-10 w-10 text-[#003366] animate-pulse" />
                                )}
                                <div>
                                    <p className="text-sm font-black text-slate-900 uppercase">{orden.estado}</p>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase mt-0.5">Vencimiento: {orden.fecha_estimada_culminacion || '---'}</p>
                                </div>
                            </div>
                            <div className="mt-8 space-y-4">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-900 flex items-center gap-2"><Calendar className="h-3 w-3 text-slate-500" /> Recepción</span>
                                    <span className="text-slate-900">{orden.fecha_recepcion || '---'}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-900 flex items-center gap-2"><Calendar className="h-3 w-3 text-slate-500" /> Est. Culminación</span>
                                    <span className="text-slate-900">{orden.fecha_estimada_culminacion || '---'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Logistics Details */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-8">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Personal Responsable</h3>
                                <div className="space-y-5">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">EP</div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest leading-none mb-1">Entregado por</p>
                                            <p className="text-sm font-black text-slate-900 uppercase leading-none">{orden.entregado_por || '---'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-[#003366] font-black text-xs">RP</div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest leading-none mb-1">Recibido por</p>
                                            <p className="text-sm font-black text-slate-900 uppercase leading-none">{orden.recibido_por || '---'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-50">
                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Canales de Informe</h3>
                                <div className="flex flex-wrap gap-2">
                                    {orden.emision_digital && (
                                        <span className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-[#0070F3] rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            <Download className="h-3 w-3" /> Digital
                                        </span>
                                    )}
                                    {orden.emision_fisica && (
                                        <span className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            <Printer className="h-3 w-3" /> Físico
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
