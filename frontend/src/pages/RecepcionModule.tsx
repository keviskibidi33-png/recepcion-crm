import React, { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import {
    Search,
    Plus,
    Eye,
    Pencil,
    Trash2,
    Filter,
    FileText,
    Calendar,
    LayoutDashboard,
    ClipboardCheck,
    Beaker,
    TrendingUp,
    LayoutGrid,
    List,
    RefreshCw,
    FileSpreadsheet,
    Upload
} from 'lucide-react'
import { recepcionApi } from '../services/recepcionApi'
import toast from 'react-hot-toast'

export default function RecepcionModule() {
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
    })
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const { data: ordenes, isLoading, isError, error: queryError, refetch } = useQuery(
        'recepciones-migration',
        () => recepcionApi.listar(),
        {
            onError: (error: any) => {
                toast.error(`Error cargando recepciones: ${error.message}`)
            },
            retry: 1
        }
    )

    // Handle Excel import
    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xlsm')) {
            toast.error('Solo se permiten archivos Excel (.xlsx, .xlsm)')
            return
        }

        setIsImporting(true)
        const loadingToast = toast.loading('Procesando Excel...')

        try {
            const importedData = await recepcionApi.importarExcel(file)
            toast.dismiss(loadingToast)
            toast.success(`Excel importado: ${importedData.muestras?.length || 0} muestras detectadas`)
            // Navigate to form with pre-filled data
            navigate('/migration/nueva-recepcion', { state: { importedData } })
        } catch (error: any) {
            toast.dismiss(loadingToast)
            const msg = error.response?.data?.detail || error.message || 'Error procesando Excel'
            toast.error(msg)
        } finally {
            setIsImporting(false)
            // Reset file input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // The following code block seems to be intended for a form submission component,
    // not directly for this RecepcionModule which primarily lists and deletes.
    const deleteMutation = useMutation(recepcionApi.eliminar, {
        onSuccess: () => {
            queryClient.invalidateQueries('recepciones-migration')
            toast.success('Recepción eliminada exitosamente')
            setDeleteId(null)
        },
        onError: (error: any) => {
            toast.error(`Error al eliminar: ${error.message}`)
        },
        onSettled: () => {
            setIsDeleting(false)
        }
    })

    const filteredData = useMemo(() => {
        if (!ordenes) return []

        let currentData = ordenes

        if (filters.search.trim()) {
            const searchLower = filters.search.toLowerCase()
            currentData = currentData.filter(orden =>
                (orden.numero_ot?.toLowerCase() || '').includes(searchLower) ||
                (orden.numero_recepcion?.toLowerCase() || '').includes(searchLower) ||
                (orden.cliente?.toLowerCase() || '').includes(searchLower)
            )
        }

        if (filters.status !== 'all') {
            currentData = currentData.filter(orden =>
                orden.estado?.toLowerCase() === filters.status
            )
        }

        return currentData
    }, [ordenes, filters])

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8 space-y-8 font-sans antialiased">
            {/* Hidden file input for Excel import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm"
                onChange={handleImportExcel}
                className="hidden"
            />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Recepciones</h1>
                    <p className="text-slate-500 font-medium mt-1">Gestiona los registros de ingreso de muestras</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                        <RefreshCw className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload className="h-5 w-5" strokeWidth={3} />
                        {isImporting ? 'Importando...' : 'Importar Recepción'}
                    </button>
                    <button
                        onClick={() => navigate('/migration/nueva-recepcion')}
                        className="flex items-center gap-3 px-5 py-3 bg-[#0070F3] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                    >
                        <Plus className="h-5 w-5" strokeWidth={3} />
                        Nueva Recepción
                    </button>
                </div>
            </div>

            {/* Filters Section - Horizontal Row like Screenshot */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por OT, Cliente o Registro..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden lg:block" />

                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none cursor-pointer focus:border-blue-500"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="en proceso">En Proceso</option>
                        <option value="completada">Completadas</option>
                    </select>

                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                        <button className="p-2 bg-white rounded-lg shadow-sm text-slate-900">
                            <LayoutGrid className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600">
                            <List className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid of Cards - As shown in CRM Screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-2xl border border-slate-200" />
                    ))
                ) : isError ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-red-200">
                        <RefreshCw className="h-16 w-16 text-red-200 mx-auto mb-4 animate-spin-slow" />
                        <p className="text-slate-600 font-bold uppercase tracking-widest">Error de conexión al servidor</p>
                        <p className="text-slate-400 text-sm mt-2">{(queryError as any)?.message}</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all"
                        >
                            Reintentar Conexión
                        </button>
                    </div>
                ) : filteredData?.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <FileSpreadsheet className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest">No se encontraron registros</p>
                    </div>
                ) : (
                    filteredData?.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-[#0070F3] font-black text-xl">
                                        {item.cliente.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 leading-tight uppercase line-clamp-1">{item.cliente}</h3>
                                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1">OT: {item.numero_ot}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${item.muestras.length > 0 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                    {item.muestras.length} Muestras
                                </span>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3 text-sm text-slate-700">
                                    <FileText className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium">Recepcion: {item.numero_recepcion}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-700">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium">{item.fecha_recepcion}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-6 border-t border-slate-50">
                                <button
                                    onClick={() => navigate(`/migration/recepciones/${item.id}`)}
                                    className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold uppercase transition-all"
                                >
                                    Detalle
                                </button>
                                <button
                                    onClick={() => item.id !== undefined && setDeleteId(item.id)}
                                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Modal - Softened */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mb-8 mx-auto">
                            <Trash2 className="h-10 w-10" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 text-center uppercase tracking-tight mb-4">¿Eliminar Registro?</h2>
                        <p className="text-slate-600 text-center font-medium mb-10 leading-relaxed">
                            Esta acción eliminará permanentemente la recepción y todas sus muestras asociadas.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deleteId)}
                                disabled={isDeleting}
                                className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 disabled:opacity-50"
                            >
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
