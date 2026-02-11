import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import {
    CloudDownload,
    Copy,
    Plus,
    Trash2,
    ChevronLeft,
    Save,
    Info,
    ListFilter,
    CreditCard,
    FileText,
    Truck,
    Check,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { recepcionApi } from '../services/recepcionApi';
import { useFormPersist } from '../hooks/use-form-persist';

// Validation Schema
// Validation Schema
// Validation Schema
const sampleSchema = z.object({
    item_numero: z.number().optional(),
    codigo_muestra_lem: z.string().optional(),
    identificacion_muestra: z.string().min(1, "Identificación Requerida"),
    estructura: z.string().min(1, "Estructura Requerida"),
    fc_kg_cm2: z.union([z.number(), z.string()]).transform((val) => Number(val) || 280),
    fecha_moldeo: z.string()
        .regex(/^(?:\d{2}\/\d{2}\/\d{4}|N\/A|NO APLICA|-)$/i, "Formato DD/MM/YYYY o N/A requerido")
        .optional(),
    hora_moldeo: z.string()
        .regex(/^(?:\d{2}:\d{2}|N\/A|NO APLICA|-)$/i, "Formato HH:mm o N/A requerido")
        .optional(),
    edad: z.union([z.number(), z.string()]).transform((val) => Number(val) || 7),
    fecha_rotura: z.string().optional(),
    requiere_densidad: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.union([z.boolean(), z.string()]).optional().transform((val) => val === true || val === "true"))
});

const formSchema = z.object({
    numero_ot: z.string().min(1, "OT Requerida"),
    numero_recepcion: z.string().min(1, "Recepción Requerida"),
    numero_cotizacion: z.string().optional(),
    cliente: z.string().min(1, "Cliente Requerido"),
    domicilio_legal: z.string().min(1, "Requerido"),
    ruc: z.string().min(8, "RUC inválido"),
    persona_contacto: z.string().min(1, "Requerido"),
    email: z.string().email("Email inválido"),
    telefono: z.string().min(7, "Teléfono inválido"),
    solicitante: z.string().min(1, "Requerido"),
    domicilio_solicitante: z.string().min(1, "Requerido"),
    proyecto: z.string().min(1, "Requerido"),
    ubicacion: z.string().min(1, "Requerido"),
    fecha_recepcion: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Fecha inválida (DD/MM/YYYY)"),
    fecha_estimada_culminacion: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Fecha inválida (DD/MM/YYYY)"),
    emision_fisica: z.boolean(),
    emision_digital: z.boolean(),
    entregado_por: z.string().min(1, "Requerido"),
    recibido_por: z.string().min(1, "Requerido"),
    observaciones: z.string().optional(),
    muestras: z.array(sampleSchema).min(1, "Mínimo una muestra")
});

type FormOutput = z.output<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

const DEFAULT_FC = 280;
const DEFAULT_EDAD = 7;

// Helpers
const incrementString = (str: string | undefined) => {
    if (!str) return '';
    
    // Pattern: 12345-CO-26 (Detect LEM code structure)
    const lemMatch = str.match(/^(\d+)(-CO-)(\d+)$/i);
    if (lemMatch) {
        const [, base, sep, year] = lemMatch;
        const newBase = String(Number(base) + 1).padStart(base.length, '0');
        return `${newBase}${sep}${year}`;
    }

    const match = str.match(/\d+/g);
    if (!match) return str;
    if (/^\d+$/.test(str)) {
        return String(Number(str) + 1).padStart(str.length, '0');
    }
    return str.replace(/(\d+)(?!.*\d)/, (match) => {
        return String(Number(match) + 1).padStart(match.length, '0');
    });
};

const getFormattedDate = (date: Date = new Date()) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

export default function OrdenForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Search status state for "Premium" interface
    const [recepcionStatus, setRecepcionStatus] = useState<{
        estado: 'idle' | 'buscando' | 'disponible' | 'ocupado';
        mensaje?: string;
        formatos?: {
            recepcion: boolean;
            verificacion: boolean;
            compresion: boolean;
        };
    }>({ estado: 'idle' });

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const isEditMode = !!id;

    // Helper to handle closing/return
    const handleClose = () => {
        if (window.self !== window.top) {
            console.log("Sending CLOSE_MODAL message to parent");
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*');
        } else {
            navigate('/migration');
        }
    };

    const { data: existingOrden, isLoading: isLoadingOrden } = useQuery(
        ['recepcion-migration', id],
        () => recepcionApi.obtener(Number(id)),
        {
            enabled: isEditMode,
            onError: (error: any) => {
                toast.error(`Error cargando recepción: ${error.message}`);
            }
        }
    );

    const form = useForm<FormInput>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            numero_recepcion: '',
            numero_ot: '',
            numero_cotizacion: '',
            cliente: '',
            ruc: '',
            domicilio_legal: '',
            persona_contacto: '',
            email: '',
            telefono: '',
            solicitante: '',
            domicilio_solicitante: '',
            proyecto: '',
            ubicacion: '',
            fecha_recepcion: getFormattedDate(),
            fecha_estimada_culminacion: getFormattedDate(),
            emision_fisica: true,
            emision_digital: true,
            entregado_por: '',
            recibido_por: 'ING. GEORGINA ALARCON',
            observaciones: '',
            muestras: [{
                identificacion_muestra: "",
                estructura: "",
                fc_kg_cm2: "" as any,
                fecha_moldeo: "",
                hora_moldeo: "",
                edad: "" as any,
                fecha_rotura: "",
                requiere_densidad: false
            }]
        }
    });

    const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = form;

    const { fields, append, remove, insert } = useFieldArray({
        control,
        name: 'muestras'
    });

    // Memoize form methods to avoid re-triggering persistence effects
    const formMethodsMemo = React.useMemo(() => ({
        watch,
        setValue,
        reset
    }), [watch, setValue, reset]);

    // Local Storage Persistence
    const { clearSavedData, hasSavedData } = useFormPersist(`recepcion-form-${id || 'new'}`, formMethodsMemo as any, !id); // Enabled only if creating new

    const [clienteSearch, setClienteSearch] = useState('');
    const [clientes, setClientes] = useState<any[]>([]);
    const [showClienteDropdown, setShowClienteDropdown] = useState(false);

    // --- TEMPLATES LOGIC ---
    const [templateSearch, setTemplateSearch] = useState('');
    const [templates, setTemplates] = useState<any[]>([]);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (templateSearch.length >= 2) {
                try {
                    const response = await recepcionApi.buscarPlantillas(templateSearch);
                    setTemplates(response || []);
                    setShowTemplateDropdown(true);
                } catch (err) {
                    setTemplates([]);
                }
            } else {
                setTemplates([]);
                setShowTemplateDropdown(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [templateSearch]);

    const handleSelectTemplate = (t: any) => {
        // Populate ALL fields
        setValue('cliente', t.cliente, { shouldValidate: true });
        setValue('ruc', t.ruc, { shouldValidate: true });
        setValue('domicilio_legal', t.domicilio_legal, { shouldValidate: true });
        setValue('persona_contacto', t.persona_contacto || '', { shouldValidate: true });
        setValue('email', t.email || '', { shouldValidate: true });
        setValue('telefono', t.telefono || '', { shouldValidate: true });
        setValue('solicitante', t.solicitante, { shouldValidate: true });
        setValue('domicilio_solicitante', t.domicilio_solicitante, { shouldValidate: true });
        setValue('proyecto', t.proyecto, { shouldValidate: true });
        setValue('ubicacion', t.ubicacion, { shouldValidate: true });

        // Logistics
        setValue('entregado_por', t.persona_contacto || '', { shouldValidate: true });

        setTemplateSearch(t.nombre_plantilla);
        setClienteSearch(t.cliente);
        setShowTemplateDropdown(false);
        toast.success(`Plantilla "${t.nombre_plantilla}" cargada`);
    };

    const handleSaveAsTemplate = async () => {
        const currentValues = watch();
        const templateName = window.prompt("Nombre para esta proyecto recepccion (ej. Edificio Mirador):", currentValues.proyecto);

        if (!templateName) return;

        try {
            const templateData = {
                nombre_plantilla: templateName,
                cliente: currentValues.cliente,
                ruc: currentValues.ruc,
                domicilio_legal: currentValues.domicilio_legal,
                persona_contacto: currentValues.persona_contacto,
                email: currentValues.email,
                telefono: currentValues.telefono,
                solicitante: currentValues.solicitante,
                domicilio_solicitante: currentValues.domicilio_solicitante,
                proyecto: currentValues.proyecto,
                ubicacion: currentValues.ubicacion
            };

            await recepcionApi.crearPlantilla(templateData);
            toast.success("¡Proyecto guardado como plantilla!");
        } catch (err: any) {
            toast.error("Error guardando plantilla: " + (err.response?.data?.detail || err.message));
        }
    };

    // Debounced client search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (clienteSearch.length >= 2) {
                try {
                    const response = await recepcionApi.buscarClientes(clienteSearch);
                    setClientes(response.data || []);
                    setShowClienteDropdown(true);
                } catch (err) {
                    setClientes([]);
                }
            } else {
                setClientes([]);
                setShowClienteDropdown(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [clienteSearch]);

    // Handle selecting a client from dropdown
    const handleSelectCliente = (c: any) => {
        const fallback = (v: any) => (v && v.toString().trim()) ? v : '-';

        // Essential fields
        setValue('cliente', fallback(c.nombre), { shouldValidate: true });
        setValue('ruc', fallback(c.ruc), { shouldValidate: true });
        setValue('domicilio_legal', fallback(c.direccion), { shouldValidate: true });
        setValue('persona_contacto', fallback(c.contacto), { shouldValidate: true });
        setValue('email', fallback(c.email), { shouldValidate: true });
        setValue('telefono', fallback(c.telefono), { shouldValidate: true });

        // Fill Solicitante (usually the same as client initially)
        setValue('solicitante', fallback(c.nombre), { shouldValidate: true });
        setValue('domicilio_solicitante', fallback(c.direccion), { shouldValidate: true });

        // Entregado por: Link to contact person
        setValue('entregado_por', fallback(c.contacto), { shouldValidate: true });

        setClienteSearch(c.nombre);
        setShowClienteDropdown(false);
        toast.success(`Cliente ${c.nombre} seleccionado`);
    };



    // Handle Cloning
    const handleClone = (index: number) => {
        const currentMuestras = watch('muestras');
        const itemToClone = currentMuestras[index];

        if (itemToClone) {
            const newItem = {
                ...itemToClone,
                item_numero: (currentMuestras.length || 0) + 1, // Placeholder, fixed on submit
                codigo_muestra_lem: incrementString(itemToClone.codigo_muestra_lem),
                identificacion_muestra: incrementString(itemToClone.identificacion_muestra),
                estructura: incrementString(itemToClone.estructura)
            };

            insert(index + 1, newItem);
            toast.success("Muestra duplicada");
        }
    };

    // Auto-calculate Fecha Rotura based on Fecha Moldeo + Edad
    const muestrasValues = watch('muestras');

    useEffect(() => {
        if (muestrasValues) {
            muestrasValues.forEach((muestra, index) => {
                const { fecha_moldeo, edad, fecha_rotura } = muestra;

                if (fecha_moldeo && edad && /^\d{2}\/\d{2}\/\d{4}$/.test(fecha_moldeo)) {
                    try {
                        const [day, month, year] = fecha_moldeo.split('/').map(Number);
                        const date = new Date(year, month - 1, day);

                        // Add days (Edad)
                        date.setDate(date.getDate() + Number(edad));

                        // Check if result is valid
                        if (!isNaN(date.getTime())) {
                            const calculatedRotura = getFormattedDate(date);
                            // Only update if value is different to avoid infinite loop
                            if (fecha_rotura !== calculatedRotura) {
                                setValue(`muestras.${index}.fecha_rotura`, calculatedRotura);
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            });
        }
    }, [JSON.stringify(muestrasValues), setValue]);

    useEffect(() => {
        if (existingOrden) {
            // ... existing reset logic check ...
            // Assuming minimal changes needed here for now
            reset(existingOrden as any);
            // Also sync search field
            if (existingOrden.cliente) {
                setClienteSearch(existingOrden.cliente);
            }
        }
    }, [existingOrden, reset]);

    const onSubmit = async (data: FormOutput) => {
        setIsSubmitting(true);
        try {
            // FORCE item_numero assignment here to prevent validation issues
            const formattedData = {
                ...data,
                muestras: data.muestras.map((m, idx) => ({
                    ...m,
                    item_numero: idx + 1
                }))
            };

            if (isEditMode) {
                await recepcionApi.actualizar(Number(id), formattedData as any);
                toast.success('¡Recepción actualizada!');
                queryClient.invalidateQueries('recepciones-migration');
                handleClose();
            } else {
                const newRecepcion = await recepcionApi.crear(formattedData as any);
                toast.success('¡Recepción creada!');

                // Auto-download Excel
                if (newRecepcion.id) {
                    try {
                        await recepcionApi.descargarExcel(newRecepcion.id, newRecepcion.numero_ot);
                    } catch (downloadError) {
                        console.error("Error downloading excel after creation:", downloadError);
                        toast.error("Recepción guardada, pero hubo un error al descargar el Excel.");
                    }
                }

                queryClient.invalidateQueries('recepciones-migration');
                handleClose();
            }
        } catch (error: any) {
            const serverMsg = error.response?.data?.message || error.message;
            toast.error(`Error: ${serverMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Smart date formatting
    const handleSmartDate = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, name: any) => {
        let val = e.target.value.trim();
        if (!val) return;

        // Ignore N/A, NO APLICA, or "-" to prevent unwanted formatting
        if (/^(N\/A|NO APLICA|-)$/i.test(val)) {
            return;
        }

        // Remove non-digits for analysis, but keep slashes if user typed them partially
        const digits = val.replace(/\D/g, '');
        const currentYear = new Date().getFullYear();

        let finalDate = '';

        // Case 0.5: "22" -> 02/02/YYYY (D/M -> DD/MM/YYYY)
        if (digits.length === 2) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1).padStart(2, '0');
            finalDate = `${d}/${m}/${currentYear}`;
        }
        // Case 1: "412" -> 04/12/YYYY (D/MM -> DD/MM/YYYY)
        else if (digits.length === 3) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1);
            finalDate = `${d}/${m}/${currentYear}`;
        }
        // Case 1.5: "21226" -> 02/12/2026 (DMMYY -> DD/MM/YYYY)
        else if (digits.length === 5) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1, 3);
            const y = digits.slice(3);
            finalDate = `${d}/${m}/20${y}`;
        }
        // Case 2: "0512" or "5/12" (digits=512 is ambiguous, assuming 4 if 0512) -> 05/12/YYYY
        else if (digits.length === 4) {
            const d = digits.slice(0, 2);
            const m = digits.slice(2);
            finalDate = `${d}/${m}/${currentYear}`;
        }
        // Case 3: "051226" -> 05/12/2026
        else if (digits.length === 6) {
            const d = digits.slice(0, 2);
            const m = digits.slice(2, 4);
            const y = digits.slice(4);
            finalDate = `${d}/${m}/20${y}`;
        }
        // Case 4: "05122026" -> 05/12/2026
        else if (digits.length === 8) {
            const d = digits.slice(0, 2);
            const m = digits.slice(2, 4);
            const y = digits.slice(4);
            finalDate = `${d}/${m}/${y}`;
        }

        if (finalDate) {
            setValue(name, finalDate, { shouldValidate: true });
        }
    };

    // SEARCH LOGIC FOR "PREMIUM" INTERFACE
    // SEARCH LOGIC FOR "PREMIUM" INTERFACE
    const buscarEstadoRecepcion = async (numero: string) => {
        if (!numero || numero.length < 3) return;

        setRecepcionStatus({ estado: 'buscando' });

        try {
            const data = await recepcionApi.validarEstado(numero);

            if (data.exists) {
                setRecepcionStatus({
                    estado: 'ocupado',
                    mensaje: `⚠️ Recepción ya registrada hace poco (Cliente: ${data.cliente || 'Desconocido'})`,
                    formatos: {
                        recepcion: data.recepcion?.status === 'COMPLETADO' || data.recepcion?.status === 'PENDIENTE',
                        verificacion: data.verificacion?.status === 'COMPLETADO' || data.verificacion?.status === 'completado',
                        compresion: data.compresion?.status === 'COMPLETADO' || data.compresion?.status === 'en_proceso' || data.compresion?.status === 'completado'
                    }
                });
            } else {
                setRecepcionStatus({
                    estado: 'disponible',
                    mensaje: '✅ Numero Disponible para registro',
                    formatos: {
                        recepcion: false,
                        verificacion: false,
                        compresion: false
                    }
                });
            }
        } catch (error) {
            console.error('Error buscando recepción:', error);
            setRecepcionStatus({
                estado: 'disponible',
                mensaje: '⚠️ Sin conexión con el servidor - Ingreso manual habilitado ✅'
            });
        }
    };

    if (isEditMode && isLoadingOrden) return <div className="p-20 text-center font-black uppercase tracking-widest text-zinc-300">Cargando Datos...</div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-900 font-sans antialiased">
            {/* Soft Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <h1 className="text-xl font-black text-[#003366] uppercase tracking-tight flex items-center gap-4">
                                Recepción de Muestra Cilíndricas de Concreto
                                {hasSavedData && (
                                    <div className="flex items-center animate-in fade-in duration-300 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                        <span className="text-[10px] text-amber-700 mr-2 font-medium tracking-normal normal-case">Borrador guardado</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                clearSavedData();
                                                setRecepcionStatus({ estado: 'idle' });
                                                setClienteSearch('');
                                                setTemplateSearch('');
                                                toast.success('Borrador eliminado y formulario reiniciado');
                                            }}
                                            className="p-1 text-amber-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            title="Descartar borrador y limpiar formulario"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </h1>
                        </div>
                    </div>

                    {/* Metadata Row */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-black text-slate-900 uppercase tracking-widest border-t border-slate-100 pt-4">
                        <div className="flex gap-6">
                            <span>CÓDIGO: <span className="text-black">F-LEM-P-01.02</span></span>
                            <span>VERSIÓN: <span className="text-black">07</span></span>
                        </div>
                        <div className="flex gap-6">
                            <span>FECHA: <span className="text-black">{new Date().toLocaleDateString('es-ES')}</span></span>
                            <span>PÁGINA: <span className="text-black">1 de 1</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
                <form onSubmit={handleSubmit(onSubmit as any, (errors) => {
                    console.error("DEBUG - Validation Errors:", errors);

                    // Recursive helper to find the first actual error message
                    const findFirstError = (errObj: any): string | null => {
                        if (errObj.message) return errObj.message;
                        if (Array.isArray(errObj)) {
                            for (const item of errObj) {
                                if (item) {
                                    const msg = findFirstError(item);
                                    if (msg) return msg;
                                }
                            }
                        }
                        if (typeof errObj === 'object') {
                            for (const key in errObj) {
                                const msg = findFirstError(errObj[key]);
                                if (msg) return msg;
                            }
                        }
                        return null;
                    };

                    const msg = findFirstError(errors);
                    if (msg) {
                        toast.error(`Error de validación: ${msg}`);
                    } else {
                        toast.error("Por favor revise los campos en rojo");
                    }
                })} className="space-y-12">
                    {/* QUICK LOAD SECTION */}
                    <div className="bg-[#003366] rounded-2xl p-8 shadow-xl border-b-4 border-blue-600 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <FileText className="h-24 w-24 text-white" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-6">
                            <div className="flex-1">
                                <label className="text-[11px] font-black text-blue-100 uppercase tracking-widest mb-3 block">
                                    ⚡ CARGA RÁPIDA (Buscador de Proyectos Recepción):
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Escribe el nombre del proyecto o cliente para autocompletar todo..."
                                        className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-blue-200/50 focus:outline-none focus:ring-4 focus:ring-white/10 transition-all font-bold"
                                    />
                                    {showTemplateDropdown && templates.length > 0 && (
                                        <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-auto py-2">
                                            {templates.map((t: any) => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => handleSelectTemplate(t)}
                                                    className="px-6 py-4 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                                >
                                                    <div className="text-[12px] font-black text-[#003366] uppercase">{t.nombre_plantilla}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                                                        {t.cliente} • {t.proyecto}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-blue-200/80 text-[10px] font-bold max-w-xs leading-relaxed uppercase tracking-tighter">
                                <span className="text-white">¿Cómo funciona?</span><br />
                                Busch un proyecto guardado para llenar el 100% de los datos del cliente e informe automáticamente. Si el proyecto es nuevo, llénalo una vez y dale a "Guardar como plantilla" abajo.
                            </div>
                        </div>
                    </div>

                    {/* TOP SECTION: IDs */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="relative">
                                <InputField
                                    label="Recepción Nº:"
                                    {...register('numero_recepcion')}
                                    onBlur={(e) => {
                                        let value = e.target.value.trim().toUpperCase();
                                        if (value) {
                                            // Smart Suffix Logic (-26 default)
                                            // Allow custom suffixes like -A, -1, or manual -25
                                            const hasYearSuffix = /-\d{2}$/.test(value);
                                            const hasExtendedSuffix = /-\d{2}-[A-Z0-9]+$/.test(value);

                                            if (!hasYearSuffix && !hasExtendedSuffix) {
                                                value = value + '-26';
                                            }

                                            // Update UI and State
                                            e.target.value = value;
                                            setValue('numero_recepcion', value, { shouldValidate: true });
                                        }

                                        buscarEstadoRecepcion(value);
                                    }}
                                    error={errors.numero_recepcion?.message}
                                    placeholder="193-26"
                                    style={{ paddingRight: '120px' }}
                                />
                                {/* Premium Status Indicator with Icons */}
                                <div className="absolute right-3 top-[32px] flex flex-col items-end gap-1.5 min-w-[100px]">
                                    {recepcionStatus.estado === 'buscando' && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 animate-pulse">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">Buscando...</span>
                                        </div>
                                    )}
                                    {recepcionStatus.estado === 'disponible' && (
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm animate-in fade-in zoom-in duration-300 transition-colors ${Object.values(recepcionStatus.formatos || {}).some(v => v)
                                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            }`}>
                                            <CheckCircle2 className="h-3 w-3" />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">Disponible</span>
                                        </div>
                                    )}
                                    {recepcionStatus.estado === 'ocupado' && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100 shadow-sm animate-in fade-in zoom-in duration-300">
                                            <XCircle className="h-3 w-3" />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">Ocupado</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status Breakdown (Formatos) - Moved below input and aligned right */}
                                <div className="mt-1 flex flex-col gap-1 items-end">
                                    {recepcionStatus.formatos && (
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mr-1 italic">Formatos:</span>
                                            <div className={`flex items-center justify-center w-7 h-4 rounded text-[8px] font-black border transition-colors ${recepcionStatus.formatos.recepcion ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>REC</div>
                                            <div className={`flex items-center justify-center w-7 h-4 rounded text-[8px] font-black border transition-colors ${recepcionStatus.formatos.verificacion ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>VER</div>
                                            <div className={`flex items-center justify-center w-7 h-4 rounded text-[8px] font-black border transition-colors ${recepcionStatus.formatos.compresion ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>COM</div>
                                        </div>
                                    )}
                                    {recepcionStatus.mensaje && recepcionStatus.estado !== 'buscando' && (
                                        <div className={`text-right text-[9px] font-black italic uppercase tracking-tighter ${recepcionStatus.estado === 'ocupado' ? 'text-rose-500' : 'text-slate-400/80'}`}>
                                            {recepcionStatus.mensaje}
                                        </div>
                                    )}
                                </div>

                            </div>
                            <InputField
                                label="Cotización Nº:"
                                {...register('numero_cotizacion')}
                                onBlur={(e) => {
                                    let value = e.target.value.trim().toUpperCase();
                                    if (value && !/^(N\/A|NO APLICA|-)$/i.test(value)) {
                                        const fullFormat = /^\d+-COT-\d{2}$/.test(value);
                                        if (!fullFormat) {
                                            const digits = value.match(/\d+/);
                                            if (digits) {
                                                value = `${digits[0]}-COT-26`;
                                            }
                                        }
                                        e.target.value = value;
                                        setValue('numero_cotizacion', value, { shouldValidate: true });
                                    }
                                }}
                                error={errors.numero_cotizacion?.message}
                                placeholder="0090-COT-26"
                            />
                            <InputField
                                label="OT Nº:"
                                {...register('numero_ot')}
                                onBlur={(e) => {
                                    let value = e.target.value.trim().toUpperCase();
                                    if (value && !/^(N\/A|NO APLICA|-)$/i.test(value)) {
                                        const fullFormat = /^OT-\d+-\d{2}$/.test(value);
                                        if (!fullFormat) {
                                            const digits = value.match(/\d+/);
                                            if (digits) {
                                                value = `OT-${digits[0]}-26`;
                                            }
                                        }
                                        e.target.value = value;
                                        setValue('numero_ot', value, { shouldValidate: true });
                                    }
                                }}
                                error={errors.numero_ot?.message}
                                placeholder="OT-196-26"
                            />
                        </div>
                    </div>

                    {/* SAMPLES TABLE SECTION */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-900 border-b border-slate-100">
                                        <th className="px-4 py-4 w-12 text-center">N°</th>
                                        <th className="px-2 py-4 w-28">Código LEM</th>
                                        <th className="px-2 py-4 w-28">Identificación</th>
                                        <th className="px-2 py-4">Estructura</th>
                                        <th className="px-2 py-4 w-16 text-center">F'c</th>
                                        <th className="px-2 py-4 w-24 text-center">Fecha moldeo</th>
                                        <th className="px-2 py-4 w-12 text-center">Hora</th>
                                        <th className="px-2 py-4 w-12 text-center">Edad</th>
                                        <th className="px-2 py-4 w-24 text-center">Fecha rotura</th>
                                        <th className="px-2 py-4 w-16 text-center">Densidad</th>
                                        <th className="px-4 py-4 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {fields.map((field, index) => {
                                        // Safe access to nested errors to check for validation issues
                                        const sampleErrors = errors.muestras?.[index];

                                        return (
                                            <tr key={field.id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-50">
                                                <td className="px-4 py-3 text-xs font-black text-slate-500 text-center">
                                                    {index + 1}
                                                    <input
                                                        type="hidden"
                                                        value={index + 1}
                                                        {...register(`muestras.${index}.item_numero`, { valueAsNumber: true })}
                                                    />
                                                </td>
                                                <td className="px-1 py-3 w-28 focus-within:z-10">
                                                    <input
                                                        {...register(`muestras.${index}.codigo_muestra_lem`)}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (/^\d+$/.test(val)) {
                                                                const year = new Date().getFullYear().toString().slice(-2);
                                                                setValue(`muestras.${index}.codigo_muestra_lem`, `${val}-CO-${year}`, { shouldValidate: true });
                                                            }
                                                        }}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.codigo_muestra_lem ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="1483"
                                                    />
                                                </td>
                                                <td className="px-1 py-3 w-28">
                                                    <input
                                                        {...register(`muestras.${index}.identificacion_muestra`)}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.identificacion_muestra ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="E-01"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        {...register(`muestras.${index}.estructura`)}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.estructura ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="ZAPATA Z-1" // Realistic structure
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        type="text"
                                                        {...register(`muestras.${index}.fc_kg_cm2`)}
                                                        className={`w-16 mx-auto block px-2 py-1.5 text-xs font-black text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.fc_kg_cm2 ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        {...register(`muestras.${index}.fecha_moldeo`)}
                                                        onBlur={(e) => {
                                                            register(`muestras.${index}.fecha_moldeo`).onBlur(e);
                                                            handleSmartDate(e, `muestras.${index}.fecha_moldeo`);
                                                        }}
                                                        className={`w-24 mx-auto block px-2 py-1.5 text-xs font-bold text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.fecha_moldeo ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="DD/MM/YYYY"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        {...register(`muestras.${index}.hora_moldeo`)}
                                                        className={`w-12 mx-auto block px-2 py-1.5 text-xs font-bold text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.hora_moldeo ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="10"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        type="text"
                                                        {...register(`muestras.${index}.edad`)}
                                                        className={`w-12 mx-auto block px-2 py-1.5 text-xs font-bold text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.edad ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        {...register(`muestras.${index}.fecha_rotura`)}
                                                        onBlur={(e) => {
                                                            register(`muestras.${index}.fecha_rotura`).onBlur(e);
                                                            handleSmartDate(e, `muestras.${index}.fecha_rotura`);
                                                        }}
                                                        className={`w-24 mx-auto block px-2 py-1.5 text-xs font-bold text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.fecha_rotura ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="DD/MM/YYYY"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <select
                                                        {...register(`muestras.${index}.requiere_densidad`)}
                                                        className="w-16 mx-auto block px-2 py-1.5 text-[10px] font-black uppercase border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm cursor-pointer appearance-none text-center"
                                                    >
                                                        <option value="">-</option>
                                                        <option value="false">NO</option>
                                                        <option value="true">SI</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleClone(index)}
                                                            className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="Clonar item"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => remove(index)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 bg-slate-50/30 border-t border-slate-50">
                            <button
                                type="button"
                                onClick={() => append({
                                    item_numero: fields.length + 1,
                                    identificacion_muestra: '',
                                    estructura: '',
                                    fc_kg_cm2: "" as any,
                                    edad: "" as any,
                                    fecha_moldeo: '',
                                    fecha_rotura: '',
                                    requiere_densidad: "" as any
                                })}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#0070F3] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Plus className="h-4 w-4" />
                                Agregar Muestra
                            </button>
                        </div>
                    </div>

                    {/* SECTION 1: FACTURACIÓN */}
                    <Section title="DATOS PARA FACTURACIÓN Y PERSONA DE CONTACTO PARA EL ENVÍO DEL INFORME DE LABORATORIO">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <InputField
                                    label="Cliente:"
                                    {...register('cliente')}
                                    onChange={(e) => {
                                        register('cliente').onChange(e);
                                        setClienteSearch(e.target.value);
                                        setShowClienteDropdown(true);
                                    }}
                                    onFocus={() => { if (clientes.length > 0) setShowClienteDropdown(true); }}
                                    error={errors.cliente?.message}
                                    placeholder="Buscar por nombre o RUC..."
                                    autoComplete="off"
                                />
                                {showClienteDropdown && clientes.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-auto py-2">
                                        {clientes.map((c: any) => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleSelectCliente(c)}
                                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                            >
                                                <div className="text-[11px] font-black text-[#003366] uppercase tracking-tight">{c.nombre}</div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                    {c.ruc && <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">RUC: {c.ruc}</span>}
                                                    {c.contacto && <span className="text-[9px] font-black text-blue-400 tracking-widest uppercase truncate max-w-[200px]">CONTACTO: {c.contacto}</span>}
                                                </div>
                                                {c.direccion && <div className="text-[9px] font-bold text-slate-300 uppercase mt-0.5 truncate italic">{c.direccion}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <InputField
                                label="RUC:"
                                {...register('ruc')}
                                error={errors.ruc?.message}
                                placeholder="20100123456" // Realistic RUC
                            />
                        </div>
                        <TextareaField
                            label="Domicilio Legal:"
                            {...register('domicilio_legal')}
                            error={errors.domicilio_legal?.message}
                            placeholder="AV. JAVIER PRADO ESTE 1234, SAN ISIDRO, LIMA" // Realistic Address
                            rows={2}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField
                                    label="Persona Contacto:"
                                    {...register('persona_contacto')}
                                    onChange={(e) => {
                                        register('persona_contacto').onChange(e);
                                        // Sync to "Entregado por"
                                        setValue('entregado_por', e.target.value.toUpperCase(), { shouldValidate: true });
                                    }}
                                    error={errors.persona_contacto?.message}
                                    placeholder="ING. JUAN PEREZ" // Realistic Contact
                                />
                            <InputField
                                label="E-mail:"
                                {...register('email')}
                                error={errors.email?.message}
                                placeholder="J.PEREZ@CONSTRUCTORA.COM" // Realistic Email
                            />
                            <InputField
                                label="Teléfono:"
                                {...register('telefono')}
                                error={errors.telefono?.message}
                                placeholder="999888777" // Realistic Phone
                            />
                        </div>
                    </Section>

                    {/* SECTION 2: INFORME */}
                    <Section title="DATOS QUE IRÁ EN EL INFORME DE LABORATORIO">
                        <InputField
                            label="Solicitante:"
                            {...register('solicitante')}
                            error={errors.solicitante?.message}
                            placeholder="CONSTRUCTORA PROYECTOS S.A.C." // Realistic Applicant
                        />
                        <TextareaField
                            label="Domicilio Legal Solicitante:"
                            {...register('domicilio_solicitante')}
                            error={errors.domicilio_solicitante?.message}
                            placeholder="AV. JAVIER PRADO ESTE 1234, SAN ISIDRO, LIMA" // Realistic Address
                            rows={2}
                        />
                        <InputField
                            label="Proyecto:"
                            {...register('proyecto')}
                            error={errors.proyecto?.message}
                            placeholder="EDIFICIO RESIDENCIAL MIRADOR" // Realistic Project
                        />
                        <TextareaField
                            label="Ubicación:"
                            {...register('ubicacion')}
                            error={errors.ubicacion?.message}
                            placeholder="CALLE LOS PINOS 456, MIRAFLORES, LIMA" // Realistic Location
                            rows={2}
                        />
                        <div className="flex justify-end pt-4">
                            <button
                                type="button"
                                onClick={handleSaveAsTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-100 transition-all border border-blue-200"
                            >
                                <Save className="h-3.5 w-3.5" />
                                Guardar estos datos como Plantilla (Proyecto)
                            </button>
                        </div>
                    </Section>

                    {/* SECTION 3: FECHAS Y EMISION */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField
                                label="FECHA DE RECEPCIÓN:"
                                {...register('fecha_recepcion')}
                                onBlur={(e) => {
                                    register('fecha_recepcion').onBlur(e);
                                    handleSmartDate(e, 'fecha_recepcion');
                                }}
                                error={errors.fecha_recepcion?.message}
                                placeholder="04/02/2026"
                            />
                            <InputField
                                label="FECHA ESTIMADA DE CULMINACIÓN:"
                                {...register('fecha_estimada_culminacion')}
                                onBlur={(e) => {
                                    register('fecha_estimada_culminacion').onBlur(e);
                                    handleSmartDate(e, 'fecha_estimada_culminacion');
                                }}
                                error={errors.fecha_estimada_culminacion?.message}
                                placeholder="08/12/2026"
                            />
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-50">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Emisión de Informes:</h4>
                            <div className="flex flex-col md:flex-row md:items-center gap-8">
                                <Checkbox
                                    label="- Físico (El cliente recoger los informes en el laboratorio)"
                                    {...register('emision_fisica')}
                                />
                                <Checkbox
                                    label="- Digital (Envio a los correos autorizados, con firma digital)"
                                    {...register('emision_digital')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: LOGÍSTICA */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField
                                label="Entregado por:"
                                {...register('entregado_por')}
                                error={errors.entregado_por?.message}
                                placeholder="TECNICO JUAN" // Realistic name
                            />
                            <InputField
                                label="Recibido por:"
                                {...register('recibido_por')}
                                error={errors.recibido_por?.message}
                                placeholder="ASIST. MARIA" // Realistic name
                            />
                        </div>
                    </div>

                    {/* SECTION 5: NOTAS */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                        <TextareaField
                            label="Nota / Observaciones (Aparecerá en el Excel):"
                            {...register('observaciones')}
                            error={errors.observaciones?.message}
                            placeholder="Escriba aquí cualquier observación adicional..."
                            rows={3}
                        />
                    </div>

                    {/* FORM FOOTER */}
                    <div className="flex items-center justify-end gap-4 pt-10">
                        <button
                            type="button"
                            onClick={() => reset()}
                            className="px-8 py-3 bg-white border border-slate-200 text-slate-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                        >
                            Limpiar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-10 py-3 bg-[#0070F3] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar Recepción' : 'Crear Recepción de Muestra')}
                        </button>
                    </div>
                </form >
            </main >
        </div >
    );
}

// Helper Components
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col gap-6">
        <h3 className="text-[10px] font-black text-[#003366] uppercase tracking-widest border-l-4 border-[#0070F3] pl-4 mb-2">
            {title}
        </h3>
        {children}
    </div>
);

const InputField = React.forwardRef<HTMLInputElement, { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>>(({ label, error, ...props }, ref) => (
    <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">
            {label}
        </label>
        <input
            {...props}
            ref={ref}
            className={`w-full px-4 py-3 bg-white border ${error ? 'border-red-500' : 'border-slate-200'} rounded-xl text-sm font-bold uppercase placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm text-slate-900`}
        />
        {error && <span className="text-[9px] font-black text-red-500 uppercase ml-1">{error}</span>}
    </div>
));

const TextareaField = React.forwardRef<HTMLTextAreaElement, { label: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ label, error, ...props }, ref) => (
    <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">
            {label}
        </label>
        <textarea
            {...props}
            ref={ref}
            className={`w-full px-4 py-3 bg-white border ${error ? 'border-red-500' : 'border-slate-200'} rounded-xl text-sm font-bold uppercase placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm text-slate-900`}
        />
        {error && <span className="text-[9px] font-black text-red-500 uppercase ml-1">{error}</span>}
    </div>
));

const Checkbox = React.forwardRef<HTMLInputElement, { label: string } & React.InputHTMLAttributes<HTMLInputElement>>(({ label, ...props }, ref) => (
    <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative flex items-center justify-center">
            <input
                type="checkbox"
                {...props}
                ref={ref}
                className="peer appearance-none h-5 w-5 border-2 border-slate-300 rounded-lg checked:border-[#0070F3] checked:bg-[#0070F3] transition-all cursor-pointer"
            />
            <Check className="h-3 w-3 text-white absolute scale-0 peer-checked:scale-100 transition-transform pointer-events-none" />
        </div>
        <span className="text-[10px] font-bold text-slate-900 group-hover:text-black transition-colors uppercase tracking-wider">
            {label}
        </span>
    </label>
));
