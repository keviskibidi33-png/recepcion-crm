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
    Check
} from 'lucide-react';
import { recepcionApi } from '../services/recepcionApi';

// Validation Schema
// Validation Schema
const sampleSchema = z.object({
    item_numero: z.number().optional(),
    codigo_muestra_lem: z.string().optional(),
    identificacion_muestra: z.string().min(1, "Identificación Requerida"),
    estructura: z.string().min(1, "Estructura Requerida"),
    fc_kg_cm2: z.union([z.number(), z.string()]).transform((val) => Number(val) || 280),
    fecha_moldeo: z.string().optional(),
    hora_moldeo: z.string().optional(),
    edad: z.union([z.number(), z.string()]).transform((val) => Number(val) || 7),
    fecha_rotura: z.string().optional(),
    requiere_densidad: z.union([z.boolean(), z.string()]).transform((val) => val === true || val === "true")
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
    muestras: z.array(sampleSchema).min(1, "Mínimo una muestra")
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_FC = 280;
const DEFAULT_EDAD = 7;

// Helpers
const incrementString = (str: string | undefined) => {
    if (!str) return '';
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

    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors }
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            fecha_recepcion: getFormattedDate(),
            fecha_estimada_culminacion: getFormattedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            emision_digital: true,
            emision_fisica: false,
            muestras: [{
                item_numero: 1,
                fc_kg_cm2: DEFAULT_FC,
                edad: DEFAULT_EDAD,
                identificacion_muestra: '',
                estructura: '',
                fecha_moldeo: '',
                fecha_rotura: '',
                requiere_densidad: false
            }]
        }
    });

    const { fields, append, remove, insert } = useFieldArray({
        control,
        name: 'muestras'
    });

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
        }
    }, [existingOrden, reset]);

    const onSubmit = async (data: FormValues) => {
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
                toast.error('Actualización no habilitada en este demo');
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

        // Remove non-digits for analysis, but keep slashes if user typed them partially
        const digits = val.replace(/\D/g, '');
        const currentYear = new Date().getFullYear();

        let finalDate = '';

        // Case 1: "512" -> 05/12/YYYY
        if (digits.length === 3) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1).padStart(2, '0');
            finalDate = `${d}/${m}/${currentYear}`;
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
                            <h1 className="text-xl font-black text-[#003366] uppercase tracking-tight">
                                Recepción de Muestra Cilíndricas de Concreto
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
                <form onSubmit={handleSubmit(onSubmit, (errors) => {
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

                    {/* TOP SECTION: IDs */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <InputField
                                label="Recepción Nº:"
                                {...register('numero_recepcion')}
                                error={errors.numero_recepcion?.message}
                                placeholder="193-26"
                            />
                            <InputField
                                label="Cotización Nº:"
                                {...register('numero_cotizacion')}
                                error={errors.numero_cotizacion?.message}
                                placeholder="0090"
                            />
                            <InputField
                                label="OT Nº:"
                                {...register('numero_ot')}
                                error={errors.numero_ot?.message}
                                placeholder="196-26"
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
                                        <th className="px-2 py-4">Código LEM</th>
                                        <th className="px-2 py-4">Identificación</th>
                                        <th className="px-2 py-4">Estructura</th>
                                        <th className="px-2 py-4 text-center">F'c</th>
                                        <th className="px-2 py-4 text-center">Fecha moldeo</th>
                                        <th className="px-2 py-4 text-center">Hora</th>
                                        <th className="px-2 py-4 text-center">Edad</th>
                                        <th className="px-2 py-4 text-center">Fecha rotura</th>
                                        <th className="px-2 py-4 text-center">Densidad</th>
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
                                                <td className="px-1 py-3 focus-within:z-10">
                                                    <input
                                                        {...register(`muestras.${index}.codigo_muestra_lem`)}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.codigo_muestra_lem ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="1483-CD-26"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <input
                                                        {...register(`muestras.${index}.identificacion_muestra`)}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.identificacion_muestra ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="E-01 / V-1.02" // Realistic sample ID
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
                                                        placeholder="280"
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
                                                        placeholder="28"
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
                                    fc_kg_cm2: DEFAULT_FC,
                                    edad: DEFAULT_EDAD,
                                    fecha_moldeo: '',
                                    fecha_rotura: '',
                                    requiere_densidad: false
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
                            <InputField
                                label="Cliente:"
                                {...register('cliente')}
                                error={errors.cliente?.message}
                                placeholder="CONSTRUCTORA PROYECTOS S.A.C." // Realistic Client
                            />
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField
                                label="Solicitante:"
                                {...register('solicitante')}
                                error={errors.solicitante?.message}
                                placeholder="CONSTRUCTORA PROYECTOS S.A.C." // Realistic Applicant
                            />
                            <InputField
                                label="Proyecto:"
                                {...register('proyecto')}
                                error={errors.proyecto?.message}
                                placeholder="EDIFICIO RESIDENCIAL MIRADOR" // Realistic Project
                            />
                        </div>
                        <TextareaField
                            label="Domicilio Legal Solicitante:"
                            {...register('domicilio_solicitante')}
                            error={errors.domicilio_solicitante?.message}
                            placeholder="AV. JAVIER PRADO ESTE 1234, SAN ISIDRO, LIMA" // Realistic Address
                            rows={2}
                        />
                        <TextareaField
                            label="Ubicación:"
                            {...register('ubicacion')}
                            error={errors.ubicacion?.message}
                            placeholder="CALLE LOS PINOS 456, MIRAFLORES, LIMA" // Realistic Location
                            rows={2}
                        />
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
                </form>
            </main>
        </div>
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
