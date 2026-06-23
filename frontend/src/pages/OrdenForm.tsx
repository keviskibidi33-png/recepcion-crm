import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import {
    CloudDownload,
    Copy,
    Plus,
    Trash2,
    X,
    Save,
    Info,
    ListFilter,
    CreditCard,
    FileText,
    Truck,
    Check,
    CheckCircle2,
    XCircle,
    Loader2,
    ChevronLeft,
    Upload
} from 'lucide-react';
import { recepcionApi } from '../services/recepcionApi';
import { useFormPersist } from '../hooks/use-form-persist';
import { useEnterTableNavigation } from '../hooks/use-enter-table-navigation';
import { ConfirmationModal } from '../components/ConfirmationModal';

// Validation Schema
// Helper: check if a YYYY/MM/DD date is within N days from today
const isDateWithinDays = (dateStr: string, days: number): boolean => {
    if (!dateStr || !/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return false;
    const [y, m, d] = dateStr.split('/').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= days;
};

const normalizeDateInput = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    let val = String(value).trim().replace(/[|]/g, '');
    if (!val) return '';

    if (/^\d{4}\/\d{2}\/\d{2}$/.test(val)) return val;

    const digits = val.replace(/\D/g, '');
    if (digits.length === 8) {
        const y = digits.slice(0, 4);
        const m = digits.slice(4, 6);
        const d = digits.slice(6, 8);
        if (Number(y) >= 1900 && Number(y) <= 2100) return `${y}/${m}/${d}`;
        return `${digits.slice(4)}/${digits.slice(2, 4)}/${digits.slice(0, 2)}`;
    }

    return val;
};

const sampleSchema = z.object({
    item_numero: z.number().optional(),
    codigo_muestra_lem: z.string().optional(),
    identificacion_muestra: z.string().min(1, "Identificación Requerida"),
    estructura: z.string().min(1, "Estructura Requerida"),
    fc_kg_cm2: z.preprocess(
        (val) => (val === null || val === undefined ? '' : val),
        z.union([z.number(), z.string()]).refine(
            (val) => Number(val) > 0,
            { message: "F'c Requerido (mayor a 0)" }
        ).transform((val) => Number(val))
    ),
    fecha_moldeo: z.preprocess(
        normalizeDateInput,
        z.string().min(1, "Fecha de moldeo Requerida").regex(/^\d{4}\/\d{2}\/\d{2}$/, "Formato YYYY/MM/DD")
    ),
    hora_moldeo: z.string().optional(),
    edad: z.preprocess(
        (val) => (val === null || val === undefined ? '' : val),
        z.union([z.number(), z.string()]).refine(
            (val) => Number(val) >= 1,
            { message: "Edad Requerida (mínimo 1)" }
        ).transform((val) => Number(val))
    ),
    fecha_rotura: z.preprocess(
        normalizeDateInput,
        z.string().min(1, "Fecha de rotura Requerida").regex(/^\d{4}\/\d{2}\/\d{2}$/, "Formato YYYY/MM/DD")
    ),
    requiere_densidad: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.union([z.boolean(), z.string()]).optional().transform((val) => val === true || val === "true"))
}).superRefine((data, ctx) => {
    // hora_moldeo required only if fecha_moldeo is within 3 days of today
    if (data.fecha_moldeo && isDateWithinDays(data.fecha_moldeo, 3)) {
        if (!data.hora_moldeo || data.hora_moldeo.trim() === '') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Hora requerida (moldeo dentro de 3 días)",
                path: ['hora_moldeo'],
            });
        }
    }
});

const formSchema = z.object({
    numero_ot: z.string().min(1, "OT Requerida"),
    numero_recepcion: z.string().min(1, "Recepción Requerida"),
    numero_cotizacion: z.preprocess((val) => (val === null ? undefined : val), z.string().optional()),
    cliente: z.string().min(1, "Cliente Requerido"),
    domicilio_legal: z.string().min(1, "Requerido"),
    ruc: z.string().trim().regex(/^\d{8,20}$/, "RUC inválido"),
    // Contact fields: individually optional, but 2 of 3 required (validated below)
    persona_contacto: z.string().optional().default(""),
    email: z.string().optional().default(""),
    telefono: z.string().optional().default(""),
    solicitante: z.string().min(1, "Requerido"),
    domicilio_solicitante: z.string().min(1, "Requerido"),
    proyecto: z.string().min(1, "Requerido"),
    ubicacion: z.string().min(1, "Requerido"),
    fecha_recepcion: z.preprocess(
        normalizeDateInput,
        z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/, "Fecha inválida (YYYY/MM/DD)")
    ),
    fecha_estimada_culminacion: z.preprocess(
        (val) => (val === null || val === undefined ? '' : val),
        z.string().refine(
            (val) => {
                const normalized = normalizeDateInput(val);
                return normalized === '' || /^\d{4}\/\d{2}\/\d{2}$/.test(normalized);
            },
            { message: "Fecha inválida (YYYY/MM/DD)" }
        )
    ),
    emision_fisica: z.preprocess((val) => val === true || val === "true" || val === "on", z.boolean()),
    emision_digital: z.preprocess((val) => val === true || val === "true" || val === "on", z.boolean()),
    entregado_por: z.string().min(1, "Requerido"),
    recibido_por: z.string().min(1, "Requerido"),
    observaciones: z.string().optional(),
    muestras: z.preprocess(
        (val) => {
            if (!Array.isArray(val)) return val;
            // Strip ghost/empty rows before validation:
            // a muestra is empty if it lacks BOTH identificacion_muestra AND fecha_moldeo
            return val.filter((m: any) => {
                if (!m || typeof m !== 'object') return false;
                const hasId = typeof m.identificacion_muestra === 'string' && m.identificacion_muestra.trim().length > 0;
                const hasDate = typeof m.fecha_moldeo === 'string' && m.fecha_moldeo.trim().length > 0;
                return hasId || hasDate;
            });
        },
        z.array(sampleSchema).min(1, "Mínimo una muestra")
    )
}).superRefine((data, ctx) => {
    // Validate at least 2 of 3 contact fields are filled
    const filledCount = [
        isMeaningfulContactValue(data.persona_contacto),
        isMeaningfulContactValue(data.email),
        isMeaningfulContactValue(data.telefono),
    ].filter(Boolean).length;

    if (filledCount < 2) {
        const msg = "Complete al menos 2 de 3: Nombre contacto, Email, Teléfono";
        if (!isMeaningfulContactValue(data.persona_contacto)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ['persona_contacto'] });
        }
        if (!isMeaningfulContactValue(data.email)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ['email'] });
        }
        if (!isMeaningfulContactValue(data.telefono)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ['telefono'] });
        }
    }

    // If email IS provided, validate each entry as a separate email (split by newline, space, comma, semicolon)
    if (isMeaningfulContactValue(data.email)) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const lines = String(data.email).split(/[\n\r\s,;]+/).map(l => l.trim()).filter(l => l.length > 0);
        const invalid = lines.filter(l => !emailRegex.test(l));
        if (invalid.length > 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Email inválido: ${invalid[0]}`, path: ['email'] });
        }
    }

    // If telefono IS provided, validate min length
    if (isMeaningfulContactValue(data.telefono) && String(data.telefono).trim().length < 7) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Teléfono inválido (mín. 7 dígitos)", path: ['telefono'] });
    }
});

type FormOutput = z.output<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;
type BackendValidationIssue = {
    loc?: Array<string | number>;
    msg?: string;
    type?: string;
    ctx?: Record<string, unknown>;
};

const DEFAULT_FC = 280;
const DEFAULT_EDAD = 7;
const CONTACT_PLACEHOLDERS = new Set(['-', '/', '--', 'N/A', 'NA', 'S/N', 'SIN ESPECIFICAR', 'NO APLICA']);

const normalizeLemCode = (val: string): string => {
    if (!val) return val;
    const cleaned = val.trim();
    if (/^\d+$/.test(cleaned)) {
        const year = new Date().getFullYear().toString().slice(-2);
        return `${cleaned}-CO-${year}`;
    }
    return cleaned;
};

const normalizeImportedText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text) return '';
    return CONTACT_PLACEHOLDERS.has(text.toUpperCase()) ? '' : text;
};

const normalizeImportedDate = (value: unknown): string => {
    const normalized = normalizeDateInput(value);
    return /^\d{4}\/\d{2}\/\d{2}$/.test(normalized) ? normalized : '';
};

const normalizeRucValue = (value: unknown): string => {
    const normalized = normalizeImportedText(value);
    if (!normalized) return '';

    const digitsOnly = normalized.replace(/\D/g, '');
    return digitsOnly.length >= 8 && digitsOnly.length <= 20 ? digitsOnly : '';
};

const getFieldPathFromBackendIssue = (issue: BackendValidationIssue): string | null => {
    if (!Array.isArray(issue.loc)) return null;

    const path = issue.loc
        .filter((part) => part !== 'body')
        .map((part) => String(part));

    return path.length > 0 ? path.join('.') : null;
};

const getBackendIssueMessage = (issue: BackendValidationIssue): string => {
    const fieldPath = getFieldPathFromBackendIssue(issue);
    const fieldName = fieldPath?.split('.').pop();

    if (fieldName === 'ruc') {
        return 'Ingresa un RUC válido de 8 a 20 dígitos.';
    }

    if (issue.type === 'string_too_long') {
        const maxLength = typeof issue.ctx?.max_length === 'number' ? issue.ctx.max_length : null;
        return maxLength ? `El valor excede el máximo permitido (${maxLength} caracteres).` : 'El valor es demasiado largo.';
    }

    if (issue.type === 'missing') {
        return 'Este campo es obligatorio.';
    }

    return issue.msg || 'Valor inválido.';
};

const getFirstClientErrorPath = (errorObject: unknown, prefix = ''): string | null => {
    if (!errorObject || typeof errorObject !== 'object') return null;

    const current = errorObject as Record<string, unknown>;
    if (typeof current.message === 'string' && prefix) {
        return prefix;
    }

    for (const [key, value] of Object.entries(current)) {
        if (key === 'message' || key === 'ref' || key === 'type') continue;
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        const nested = getFirstClientErrorPath(value, nextPrefix);
        if (nested) return nested;
    }

    return null;
};

const isMeaningfulContactValue = (value: unknown): boolean => {
    const normalized = normalizeImportedText(value);
    return normalized.length > 0;
};

const hasMeaningfulMuestraData = (m: any): boolean => {
    if (!m || typeof m !== 'object') return false;
    const textFields = [
        m.codigo_muestra_lem,
        m.identificacion_muestra,
        m.descripcion,
        m.estructura,
        m.fecha_moldeo,
        m.fecha_rotura
    ];
    const hasText = textFields.some((v) => normalizeImportedText(v).length > 0);
    const hasNumeric = [m.fc_kg_cm2, m.edad].some((v) => v !== null && v !== undefined && String(v).trim() !== '' && Number(v) > 0);
    return hasText || hasNumeric;
};

const sanitizeImportedMuestras = (muestras: any[] | undefined | null) => {
    if (!Array.isArray(muestras)) return [];

    const sanitized = muestras
        .filter((m) => hasMeaningfulMuestraData(m))
        .map((m, idx) => ({
            item_numero: idx + 1,
            codigo_muestra_lem: normalizeLemCode(normalizeImportedText(m.codigo_muestra_lem)),
            identificacion_muestra: String(m.identificacion_muestra || m.descripcion || '').trim(),
            estructura: String(m.estructura || '').trim(),
            fc_kg_cm2: (m.fc_kg_cm2 !== null && m.fc_kg_cm2 !== undefined && String(m.fc_kg_cm2).trim() !== '') ? m.fc_kg_cm2 : (DEFAULT_FC as any),
            edad: (m.edad !== null && m.edad !== undefined && String(m.edad).trim() !== '') ? m.edad : (DEFAULT_EDAD as any),
            requiere_densidad: m.requiere_densidad === true || m.requiere_densidad === 'true' || String(m.requiere_densidad || '').trim().toUpperCase() === 'SI',
            fecha_moldeo: normalizeImportedDate(m.fecha_moldeo),
            hora_moldeo: normalizeImportedText(m.hora_moldeo),
            fecha_rotura: normalizeImportedDate(m.fecha_rotura),
        }));

    return sanitized.length > 0 ? sanitized : [{
        item_numero: 1,
        codigo_muestra_lem: '',
        identificacion_muestra: '',
        estructura: '',
        fc_kg_cm2: '' as any,
        edad: '' as any,
        requiere_densidad: false,
        fecha_moldeo: '',
        hora_moldeo: '',
        fecha_rotura: '',
    }];
};

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

const extractLeadingNumber = (value: string | undefined) => {
    if (!value) return Number.NaN;
    const match = value.trim().match(/^(\d+)/);
    return match ? Number(match[1]) : Number.NaN;
};

const getFormattedDate = (date: Date = new Date()) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${y}/${m}/${d}`;
};

export default function OrdenForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const handleItemsTableKeyDown = useEnterTableNavigation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRefExport = useRef<HTMLInputElement>(null);

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
    const location = useLocation();

    const isEditMode = !!id;
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    
    const form = useForm<FormInput>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            muestras: [{ item_numero: 1, identificacion_muestra: "", estructura: "", fc_kg_cm2: "" as any, edad: "" as any, requiere_densidad: false, fecha_moldeo: "", hora_moldeo: "", fecha_rotura: "", codigo_muestra_lem: "" }]
        }
    });

    const { register, control, handleSubmit, setValue, watch, reset, getValues, setError, clearErrors, setFocus, formState: { errors } } = form;
    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: 'muestras'
    });

    const focusFieldByPath = (fieldPath: string) => {
        try {
            setFocus(fieldPath as any);
        } catch {
            // Ignore setFocus mismatches and fallback to DOM lookup below.
        }

        requestAnimationFrame(() => {
            const field = document.getElementsByName(fieldPath)[0] as HTMLElement | undefined;
            if (!field) return;
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if ('focus' in field && typeof field.focus === 'function') {
                field.focus();
            }
        });
    };

    const applyBackendValidationErrors = (issues: BackendValidationIssue[]) => {
        const fieldIssues = issues
            .map((issue) => ({
                path: getFieldPathFromBackendIssue(issue),
                message: getBackendIssueMessage(issue),
            }))
            .filter((issue): issue is { path: string; message: string } => Boolean(issue.path));

        if (fieldIssues.length === 0) return false;

        fieldIssues.forEach(({ path, message }) => {
            setError(path as any, { type: 'server', message });
        });

        const firstIssue = fieldIssues[0];
        focusFieldByPath(firstIssue.path);
        toast.error(`Revisa el campo resaltado: ${firstIssue.message}`);
        return true;
    };

    // Helper to handle closing/return
    const handleClose = (reason?: unknown) => {
        const closeReason = reason === 'created' || reason === 'updated' ? reason : undefined;
        if (window.self !== window.top) {
            console.log("Sending CLOSE_MODAL message to parent", closeReason);
            window.parent.postMessage({ type: 'CLOSE_MODAL', reason: closeReason }, '*');
        } else {
            if (closeReason === 'created') toast.success('¡Recepción creada!');
            else if (closeReason === 'updated') toast.success('¡Recepción actualizada!');
            navigate('/migration');
        }
    };

    const syncEntregadoPorFromContacto = (contacto: unknown, options?: { force?: boolean }) => {
        const normalizedContacto = normalizeImportedText(contacto).toUpperCase();
        if (!normalizedContacto) return;

        const currentEntregado = normalizeImportedText(getValues('entregado_por'));
        if (options?.force || !currentEntregado) {
            setValue('entregado_por', normalizedContacto, { shouldValidate: true });
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

    // Pre-fill from imported Excel data (via navigation state)
    useEffect(() => {
        const state = location.state as { importedData?: any } | null;
        if (state?.importedData && !isEditMode) {
            const d = state.importedData;
            console.debug('[OrdenForm] Pre-filling from imported Excel:', d);

            // Pre-fill header fields
            if (d.numero_recepcion !== undefined) setValue('numero_recepcion', normalizeImportedText(d.numero_recepcion).toUpperCase());
            if (d.numero_cotizacion !== undefined) setValue('numero_cotizacion', normalizeImportedText(d.numero_cotizacion).toUpperCase());
            if (d.numero_ot !== undefined) setValue('numero_ot', normalizeImportedText(d.numero_ot).toUpperCase());
            if (d.cliente) setValue('cliente', normalizeImportedText(d.cliente));
            if (d.ruc) setValue('ruc', normalizeRucValue(d.ruc));
            if (d.persona_contacto) {
                const personaContacto = normalizeImportedText(d.persona_contacto);
                setValue('persona_contacto', personaContacto);
                syncEntregadoPorFromContacto(personaContacto);
            }
            if (d.telefono) setValue('telefono', normalizeImportedText(d.telefono));
            if (d.email) setValue('email', normalizeImportedText(d.email));
            if (d.proyecto) setValue('proyecto', normalizeImportedText(d.proyecto));
            if (d.ubicacion) setValue('ubicacion', normalizeImportedText(d.ubicacion));
            if (d.solicitante) setValue('solicitante', normalizeImportedText(d.solicitante));
            if (d.domicilio_solicitante) setValue('domicilio_solicitante', normalizeImportedText(d.domicilio_solicitante));
            if (d.domicilio_legal) setValue('domicilio_legal', normalizeImportedText(d.domicilio_legal || d.ubicacion || ''));
            if (d.fecha_recepcion) setValue('fecha_recepcion', normalizeImportedDate(d.fecha_recepcion));
            if (d.fecha_estimada_culminacion) setValue('fecha_estimada_culminacion', normalizeImportedDate(d.fecha_estimada_culminacion));

            // Pre-fill muestras array
            if (Array.isArray(d.muestras) && d.muestras.length > 0) {
                replace(sanitizeImportedMuestras(d.muestras) as any);
            }

            // Clear navigation state to prevent re-fill on re-render
            window.history.replaceState({}, document.title);
            toast.success(`Datos importados: ${d.muestras?.length || 0} muestras cargadas al formulario`);
        }
    }, [location.state, isEditMode, setValue, replace]);

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xlsm')) {
            toast.error("Solo se permiten archivos Excel (.xlsx, .xlsm)");
            return;
        }

        setIsImporting(true);
        const loadingToast = toast.loading("Procesando Excel...");

        try {
            const data = await recepcionApi.importarExcel(file);
            toast.dismiss(loadingToast);
            toast.success(`Excel importado: ${data.muestras?.length || 0} muestras detectadas`);
            
            // Pre-fill header
            if (data.numero_recepcion !== undefined) setValue('numero_recepcion', normalizeImportedText(data.numero_recepcion).toUpperCase());
            if (data.numero_cotizacion !== undefined) setValue('numero_cotizacion', normalizeImportedText(data.numero_cotizacion).toUpperCase());
            if (data.numero_ot !== undefined) setValue('numero_ot', normalizeImportedText(data.numero_ot).toUpperCase());
            if (data.cliente) setValue('cliente', normalizeImportedText(data.cliente));
            if (data.ruc) setValue('ruc', normalizeRucValue(data.ruc));
            if (data.proyecto) setValue('proyecto', normalizeImportedText(data.proyecto));
            if (data.ubicacion) setValue('ubicacion', normalizeImportedText(data.ubicacion));
            if (data.solicitante) setValue('solicitante', normalizeImportedText(data.solicitante));
            if (data.domicilio_solicitante) setValue('domicilio_solicitante', normalizeImportedText(data.domicilio_solicitante));
            if (data.domicilio_legal) setValue('domicilio_legal', normalizeImportedText(data.domicilio_legal || data.ubicacion || ''));
            if (data.fecha_recepcion) setValue('fecha_recepcion', normalizeImportedDate(data.fecha_recepcion));
            if (data.fecha_estimada_culminacion) setValue('fecha_estimada_culminacion', normalizeImportedDate(data.fecha_estimada_culminacion));
            if (data.persona_contacto) {
                const personaContacto = normalizeImportedText(data.persona_contacto);
                setValue('persona_contacto', personaContacto);
                syncEntregadoPorFromContacto(personaContacto);
            }
            if (data.telefono) setValue('telefono', normalizeImportedText(data.telefono));
            if (data.email) setValue('email', normalizeImportedText(data.email));

            // Pre-fill muestras
            if (Array.isArray(data.muestras) && data.muestras.length > 0) {
                replace(sanitizeImportedMuestras(data.muestras) as any);
            }
        } catch (error: any) {
            toast.dismiss(loadingToast);
            toast.error(error.message || "Error al procesar el Excel");
        } finally {
            setIsImporting(false);
            if (fileInputRefExport.current) fileInputRefExport.current.value = "";
        }
    };

    // Listen for data from parent Shell (crm-geofal)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'IMPORT_DATA' && !isEditMode) {
                const d = event.data.data;
                console.debug('[OrdenForm] Received IMPORT_DATA from parent:', d);
                
                // Pre-fill header
                if (d.cliente) setValue('cliente', normalizeImportedText(d.cliente));
                if (d.ruc) setValue('ruc', normalizeRucValue(d.ruc));
                if (d.proyecto) setValue('proyecto', normalizeImportedText(d.proyecto));
                if (d.ubicacion) setValue('ubicacion', normalizeImportedText(d.ubicacion));
                if (d.solicitante) setValue('solicitante', normalizeImportedText(d.solicitante));
                if (d.domicilio_solicitante) setValue('domicilio_solicitante', normalizeImportedText(d.domicilio_solicitante));
                if (d.domicilio_legal) setValue('domicilio_legal', normalizeImportedText(d.domicilio_legal || d.ubicacion || ''));
                if (d.fecha_recepcion) setValue('fecha_recepcion', normalizeImportedDate(d.fecha_recepcion));
                if (d.fecha_estimada_culminacion) setValue('fecha_estimada_culminacion', normalizeImportedDate(d.fecha_estimada_culminacion));
                if (d.persona_contacto) {
                    const personaContacto = normalizeImportedText(d.persona_contacto);
                    setValue('persona_contacto', personaContacto);
                    syncEntregadoPorFromContacto(personaContacto);
                }
                if (d.telefono) setValue('telefono', normalizeImportedText(d.telefono));
                if (d.email) setValue('email', normalizeImportedText(d.email));

                // Pre-fill muestras
                if (Array.isArray(d.muestras) && d.muestras.length > 0) {
                    replace(sanitizeImportedMuestras(d.muestras) as any);
                }
                toast.success(`Datos importados desde Excel: ${d.muestras?.length || 0} muestras cargadas`);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [isEditMode, setValue, replace]);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sampleDeleteIndex, setSampleDeleteIndex] = useState<number | null>(null);

    const handleConfirmDelete = () => {
        clearSavedData();
        setRecepcionStatus({ estado: 'idle' });
        setClienteSearch('');
        setTemplateSearch('');
        // Explicitly reset to default values to ensure clean state
        reset(defaultValues);
        toast.success('Borrador eliminado y formulario reiniciado');
        setIsDeleteModalOpen(false);
    };

    const handleRequestSampleDelete = (index: number) => {
        setSampleDeleteIndex(index);
    };

    const handleConfirmSampleDelete = () => {
        if (sampleDeleteIndex === null) return;
        remove(sampleDeleteIndex);
        setSampleDeleteIndex(null);
        toast.success('Muestra eliminada del formulario');
    };

    const defaultValues: FormInput = {
        numero_ot: "",
        numero_recepcion: "",
        numero_cotizacion: "",
        cliente: "",
        domicilio_legal: "",
        ruc: "",
        persona_contacto: "",
        email: "",
        telefono: "",
        solicitante: "",
        domicilio_solicitante: "",
        proyecto: "",
        ubicacion: "",
        fecha_recepcion: "",
        fecha_estimada_culminacion: "",
        emision_fisica: false,
        emision_digital: false,
        entregado_por: "",
        recibido_por: "",
        observaciones: "",
        muestras: [{
            identificacion_muestra: "",
            estructura: "",
            fc_kg_cm2: "" as any,
            edad: "" as any,
            requiere_densidad: "" as any,
            fecha_moldeo: "",
            hora_moldeo: "",
            fecha_rotura: "",
            codigo_muestra_lem: ""
        }]
    };

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
    const isSelectionRef = useRef(false);

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
        setValue('ruc', normalizeRucValue(t.ruc), { shouldValidate: true });
        setValue('domicilio_legal', t.domicilio_legal, { shouldValidate: true });
        setValue('persona_contacto', normalizeImportedText(t.persona_contacto), { shouldValidate: true });
        setValue('email', normalizeImportedText(t.email), { shouldValidate: true });
        setValue('telefono', normalizeImportedText(t.telefono), { shouldValidate: true });
        setValue('solicitante', t.solicitante, { shouldValidate: true });
        setValue('domicilio_solicitante', t.domicilio_solicitante, { shouldValidate: true });
        setValue('proyecto', t.proyecto, { shouldValidate: true });
        setValue('ubicacion', t.ubicacion, { shouldValidate: true });

        // Logistics
        syncEntregadoPorFromContacto(t.persona_contacto, { force: true });

        setTemplateSearch(t.nombre_plantilla);
        isSelectionRef.current = true;
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
        if (isSelectionRef.current) {
            isSelectionRef.current = false;
            return;
        }
        
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
        setValue('ruc', normalizeRucValue(c.ruc), { shouldValidate: true });
        setValue('domicilio_legal', fallback(c.direccion), { shouldValidate: true });
        setValue('persona_contacto', normalizeImportedText(c.contacto), { shouldValidate: true });
        setValue('email', normalizeImportedText(c.email), { shouldValidate: true });
        setValue('telefono', normalizeImportedText(c.telefono), { shouldValidate: true });

        // Fill Solicitante (usually the same as client initially)
        setValue('solicitante', fallback(c.nombre), { shouldValidate: true });
        setValue('domicilio_solicitante', fallback(c.direccion), { shouldValidate: true });

        // Entregado por: Link to contact person
        syncEntregadoPorFromContacto(c.contacto, { force: true });

        isSelectionRef.current = true;
        setClienteSearch(c.nombre);
        setShowClienteDropdown(false);
        toast.success(`Cliente ${c.nombre} seleccionado`);
    };



    // Handle Cloning — auto-detects last LEM code and increments consecutively
    const handleClone = (index: number) => {
        const currentMuestras = watch('muestras');
        const itemToClone = currentMuestras[index];
        if (!itemToClone) return;

        const existingCodes = new Set(
            currentMuestras
                .map((m) => m.codigo_muestra_lem?.trim().toUpperCase())
                .filter((code): code is string => Boolean(code))
        );

        // Use the highest numeric prefix across all rows as base (e.g. 9091-CO-26 -> 9092-CO-26)
        let lastLem = itemToClone.codigo_muestra_lem?.trim() || '';
        for (const m of currentMuestras) {
            const candidate = m.codigo_muestra_lem?.trim();
            if (!candidate) continue;

            const candidateNum = extractLeadingNumber(candidate);
            const lastNum = extractLeadingNumber(lastLem);
            if (!Number.isNaN(candidateNum) && (Number.isNaN(lastNum) || candidateNum > lastNum)) {
                lastLem = candidate;
            }
        }

        const isPlaceholderCode = lastLem.trim() === '-';
        let nextLem = isPlaceholderCode ? '-' : incrementString(lastLem);
        while (!isPlaceholderCode && nextLem && existingCodes.has(nextLem.trim().toUpperCase())) {
            nextLem = incrementString(nextLem);
        }

        // Exclude react-hook-form internal 'id' to prevent ghost/empty rows
        const { id: _rhfId, ...cloneData } = itemToClone as any;

        const isYmd = (value: unknown) => typeof value === 'string' && /^\d{4}\/\d{2}\/\d{2}$/.test(value.trim());
        const isHms = (value: unknown) => typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value.trim());

        const newItem = {
            ...cloneData,
            item_numero: (currentMuestras.length || 0) + 1,
            codigo_muestra_lem: nextLem,
            fecha_moldeo: isYmd(cloneData.fecha_moldeo) ? cloneData.fecha_moldeo.trim() : '',
            fecha_rotura: isYmd(cloneData.fecha_rotura) ? cloneData.fecha_rotura.trim() : '',
            hora_moldeo: isHms(cloneData.hora_moldeo) ? cloneData.hora_moldeo.trim() : '',
        };

        append(newItem);
        toast.success(`✓ Muestra duplicada (${currentMuestras.length + 1} total)`, { id: 'clone-toast' });
    };

    // Auto-calculate Fecha Rotura based on Fecha Moldeo + Edad
    const muestrasValues = watch('muestras');

    useEffect(() => {
        if (muestrasValues) {
            muestrasValues.forEach((muestra, index) => {
                const { fecha_moldeo, edad, fecha_rotura } = muestra;

                if (fecha_moldeo && edad && /^\d{4}\/\d{2}\/\d{2}$/.test(fecha_moldeo)) {
                    try {
                        const [year, month, day] = fecha_moldeo.split('/').map(Number);
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
                isSelectionRef.current = true;
                setClienteSearch(existingOrden.cliente);
            }
        }
    }, [existingOrden, reset]);

    const onSubmit = async (data: FormOutput) => {
        setIsSubmitting(true);
        clearErrors();
        try {
            // FORCE item_numero assignment here to prevent validation issues
            const formattedData = {
                ...data,
                muestras: data.muestras.map((m, idx) => ({
                    ...m,
                    item_numero: idx + 1,
                    codigo_muestra_lem: normalizeLemCode(m.codigo_muestra_lem || '')
                }))
            };

            if (isEditMode) {
                await recepcionApi.actualizar(Number(id), formattedData as any);
                await Promise.all([
                    queryClient.invalidateQueries('recepciones-migration'),
                    queryClient.invalidateQueries(['recepcion-migration', id]),
                ]);
                handleClose('updated');
            } else {
                await recepcionApi.crear(formattedData as any);
                await queryClient.invalidateQueries('recepciones-migration');
                handleClose('created');
            }
        } catch (error: any) {
            const status = error?.response?.status;
            const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Error inesperado";
            const detailLower = typeof detail === "string" ? detail.toLowerCase() : "";

            if (status === 422 && Array.isArray(detail) && applyBackendValidationErrors(detail)) {
                return;
            }

            let tipo = "Error";
            if (status === 409) {
                if (detailLower.includes("número ot") || detailLower.includes("numero ot") || detailLower.includes("ot")) {
                    tipo = "OT duplicada";
                } else if (detailLower.includes("número de recepción") || detailLower.includes("numero de recepcion") || detailLower.includes("recepción") || detailLower.includes("recepcion")) {
                    tipo = "Recepción duplicada";
                } else {
                    tipo = "Conflicto";
                }
            } else if (status === 400) {
                tipo = "Datos inválidos";
            } else if (status === 401) {
                tipo = "Sesión expirada";
            } else if (status === 500) {
                tipo = "Error interno";
            }

            toast.error(`[${tipo}] ${detail}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Smart date formatting
    const handleSmartDate = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, name: any) => {
        const val = e.target.value.trim();
        if (!val) return;

        // Preferred format: YYYY/MM/DD. Accept legacy inputs and normalize.
        if (val.includes('/')) {
            const parts = val.split('/');
            if (parts.length >= 2) {
                const currentYear = new Date().getFullYear().toString();
                let y = '';
                let m = '';
                let d = '';

                if (parts[0].trim().length === 4) {
                    y = parts[0].trim();
                    m = parts[1].trim().padStart(2, '0');
                    d = (parts[2] || '').trim().padStart(2, '0');
                } else {
                    d = parts[0].trim().padStart(2, '0');
                    m = parts[1].trim().padStart(2, '0');
                    y = (parts[2] || '').trim();
                    if (!y) y = currentYear;
                    if (y.length === 2) y = `20${y}`;
                }

                if (d.length === 2 && m.length === 2 && y.length === 4) {
                    const finalDate = `${y}/${m}/${d}`;
                    setValue(name, finalDate, { shouldValidate: true });
                    return;
                }
            }
        }

        const digits = val.replace(/\D/g, '');
        const currentYear = new Date().getFullYear().toString();

        let finalDate = '';

        // Compact inputs -> normalize to YYYY/MM/DD (prefer year-first)
        if (digits.length === 2) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1).padStart(2, '0');
            finalDate = `${currentYear}/${m}/${d}`;
        } else if (digits.length === 3) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1);
            finalDate = `${currentYear}/${m}/${d}`;
        } else if (digits.length === 5) {
            const d = digits.slice(0, 1).padStart(2, '0');
            const m = digits.slice(1, 3);
            const y = digits.slice(3);
            finalDate = `20${y}/${m}/${d}`;
        } else if (digits.length === 4) {
            const m = digits.slice(0, 2);
            const d = digits.slice(2);
            finalDate = `${currentYear}/${m}/${d}`;
        } else if (digits.length === 6) {
            // Prefer YYYYMM; fallback DDMMYY
            const firstFour = Number(digits.slice(0, 4));
            if (firstFour >= 1900 && firstFour <= 2100) {
                const y = digits.slice(0, 4);
                const m = digits.slice(4, 6);
                finalDate = `${y}/${m}/01`;
            } else {
                const d = digits.slice(0, 2);
                const m = digits.slice(2, 4);
                const y = digits.slice(4);
                finalDate = `20${y}/${m}/${d}`;
            }
        } else if (digits.length === 8) {
            // Prefer YYYYMMDD; fallback DDMMYYYY
            const y = digits.slice(0, 4);
            const m = digits.slice(4, 6);
            const d = digits.slice(6, 8);
            if (Number(y) > 1900) finalDate = `${y}/${m}/${d}`;
            else {
                const dd = digits.slice(0, 2);
                const mm = digits.slice(2, 4);
                const yyyy = digits.slice(4);
                finalDate = `${yyyy}/${mm}/${dd}`;
            }
        }

        if (finalDate) {
            setValue(name, finalDate, { shouldValidate: true });
        }
    };

    // SEARCH LOGIC FOR RECEPCIÓN PROBETAS
    // Importante: aquí solo debe bloquear la tabla `recepcion`.
    // Verificación/compresión/trazabilidad pueden existir para un número restaurado
    // y no deben marcarlo como ocupado al crear nuevamente la recepción.
    const buscarEstadoRecepcion = async (numero: string) => {
        if (!numero || numero.length < 3) return;

        setRecepcionStatus({ estado: 'buscando' });

        try {
            const data = await recepcionApi.buscarRecepcion(numero);

            if (data.encontrado) {
                setRecepcionStatus({
                    estado: 'ocupado',
                    mensaje: `⚠️ Recepción ya registrada en Recepción Probetas (OT: ${data.datos?.numero_ot || '-'})`,
                    formatos: {
                        recepcion: true,
                        verificacion: false,
                        compresion: false
                    }
                });
            } else {
                setRecepcionStatus({
                    estado: 'disponible',
                    mensaje: '✅ Número disponible en Recepción Probetas',
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

    if (isEditMode && isLoadingOrden) return <div className="p-20 text-center font-black uppercase tracking-widest text-zinc-300 flex items-center justify-center gap-3">
        <Loader2 className="animate-spin h-6 w-6" />
        Cargando Datos...
    </div>;

    return (
        <div className="h-screen overflow-y-auto bg-[#F8FAFC] pb-20 text-slate-900 font-sans antialiased">
            {/* Soft Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-2">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-[#0070F3] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                                <Plus className="h-5 w-5" strokeWidth={3} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">
                                    {isEditMode ? 'Editar Recepción' : 'Nueva Recepción'}
                                </h2>
                                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em] mt-0.5 flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    Registro Geofal v2.0
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-red-50 hover:text-red-500 transition-all flex items-center gap-2 border border-slate-100"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Limpiar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleClose()}
                                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2"
                            >
                                <X className="h-3.5 w-3.5" />
                                <span>Cerrar</span>
                            </button>
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
                    console.error("DEBUG - Validation Errors:", JSON.stringify(errors, (key, value) => {
                        if (key === 'ref') return undefined; // Skip DOM refs in serialization
                        return value;
                    }, 2));

                    const firstErrorPath = getFirstClientErrorPath(errors);
                    if (firstErrorPath) {
                        focusFieldByPath(firstErrorPath);
                    }

                    // Collect ALL errors for debug toast - improved to show field names clearly
                    const getAllErrorMessages = (errObj: any, prefix = ''): string[] => {
                        let messages: string[] = [];
                        if (errObj.message && typeof errObj.message === 'string') {
                            const fieldName = prefix || 'formulario';
                            messages.push(`${fieldName}: ${errObj.message}`);
                        }
                        if (typeof errObj === 'object' && errObj !== null) {
                            for (const key in errObj) {
                                if (key !== 'message' && key !== 'ref' && key !== 'type') {
                                    const newPrefix = prefix ? `${prefix}.${key}` : key;
                                    messages = [...messages, ...getAllErrorMessages(errObj[key], newPrefix)];
                                }
                            }
                        }
                        return messages;
                    };

                    const allErrors = getAllErrorMessages(errors);
                    if (allErrors.length > 0) {
                        toast.error(`Revisa el campo resaltado en rojo. ${allErrors[0]}`, {
                            duration: 8000,
                            style: { textAlign: 'left', whiteSpace: 'pre-line' }
                        });
                    } else {
                        toast.error("Por favor revise los campos en rojo");
                    }
                })} className="space-y-12">
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
                                error={errors.numero_cotizacion?.message}
                                placeholder="0090-COT-26"
                                onBlur={async (e) => {
                                    let value = e.target.value.trim().toUpperCase();
                                    if (!value) return;
                                    const previousCotizacion = normalizeImportedText(getValues('numero_cotizacion')).toUpperCase();

                                    // Normailze format
                                    const fullFormat = /^\d+-COT-\d{2}$/.test(value);
                                    if (!fullFormat) {
                                        const digits = value.match(/\d+/);
                                        if (digits) {
                                            value = `${digits[0]}-COT-26`;
                                        }
                                    }
                                    // Also support simplified input "123-26" -> internally handled as token
                                    
                                    e.target.value = value;
                                    setValue('numero_cotizacion', value, { shouldValidate: true });

                                    // If fields were already imported/filled and cotización didn't change,
                                    // avoid redundant quote lookup (prevents noisy 404 on blur).
                                    const hasImportedHeaderData = Boolean(
                                        normalizeImportedText(getValues('cliente')) ||
                                        normalizeImportedText(getValues('proyecto')) ||
                                        normalizeImportedText(getValues('persona_contacto'))
                                    );
                                    if (hasImportedHeaderData && previousCotizacion === value) {
                                        return;
                                    }

                                    // Extract simple token: "090-COT-26" -> "090-26"
                                    const match = value.match(/^(\d+)-COT-(\d+)$/);
                                    if (match) {
                                        const token = `${match[1]}-${match[2]}`;
                                        try {
                                            toast.loading('Buscando cotización...');
                                            const res = await recepcionApi.obtenerCotizacionPorToken(token);
                                            toast.dismiss();
                                            
                                            if (res.success && res.data) {
                                                const q = res.data;
                                                toast.success(`Cotización encontrada: ${q.cliente}`);
                                                
                                                // Auto-fill Client Data
                                                setValue('cliente', normalizeImportedText(q.cliente), { shouldValidate: true });
                                                isSelectionRef.current = true;
                                                setClienteSearch(normalizeImportedText(q.cliente));
                                                setValue('ruc', normalizeRucValue(q.ruc), { shouldValidate: true });
                                                setValue('persona_contacto', normalizeImportedText(q.contacto), { shouldValidate: true });
                                                syncEntregadoPorFromContacto(q.contacto);
                                                setValue('email', normalizeImportedText(q.email), { shouldValidate: true });
                                                setValue('telefono', normalizeImportedText(q.telefono), { shouldValidate: true });
                                                setValue('proyecto', normalizeImportedText(q.proyecto), { shouldValidate: true });
                                                setValue('ubicacion', normalizeImportedText(q.ubicacion), { shouldValidate: true });

                                                // Auto-fill Samples (Items)
                                                if (q.items_json && Array.isArray(q.items_json)) {
                                                    const newMuestras = sanitizeImportedMuestras(q.items_json.map((item: any, idx: number) => ({
                                                        item_numero: idx + 1,
                                                        identificacion_muestra: item.descripcion || `Muestra ${idx + 1}`,
                                                        estructura: '', // Manual fill usually
                                                        fc_kg_cm2: DEFAULT_FC,
                                                        edad: DEFAULT_EDAD,
                                                        requiere_densidad: false,
                                                        fecha_moldeo: '',
                                                        hora_moldeo: '',
                                                        fecha_rotura: '',
                                                        codigo_muestra_lem: '' // Will be auto-generated
                                                    })));
                                                    
                                                    // Replace current fields
                                                    replace(newMuestras as any);
                                                    toast.success(`${newMuestras.length} items importados de la cotización`);
                                                }
                                            } else if (res?.notFound) {
                                                // Token does not exist in cotizaciones; keep silent to avoid noisy UX
                                            }
                                        } catch (err) {
                                            toast.dismiss();
                                            console.warn("Quote fetch error (non-404):", err);
                                        }
                                    }
                                }}
                            />
                            <InputField
                                label="OT Nº:"
                                {...register('numero_ot')}
                                autoComplete="off"
                                onBlur={(e) => {
                                    let value = e.target.value.trim().toUpperCase();
                                    if (value) {
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
                            <table className="w-full text-left border-collapse" onKeyDown={handleItemsTableKeyDown}>
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-900 border-b border-slate-100">
                                        <th className="px-4 py-4 w-12 text-center">N°</th>
                                        <th className="px-2 py-4 w-36">Código LEM</th>
                                        <th className="px-2 py-4 w-40">Código</th>
                                        <th className="px-2 py-4 w-48">Estructura</th>
                                        <th className="px-2 py-4 w-16 text-center">F'c</th>
                                        <th className="px-2 py-4 w-24 text-center">Fecha moldeo</th>
                                        <th className="px-2 py-4 w-20 text-center">Hora Moldeo</th>
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
                                                <td className="px-1 py-3 w-36 focus-within:z-10 align-top">
                                                    <textarea
                                                        {...register(`muestras.${index}.codigo_muestra_lem`)}
                                                        rows={1}
                                                        onInput={(e) => {
                                                            const t = e.currentTarget;
                                                            t.style.height = 'auto';
                                                            t.style.height = t.scrollHeight + 'px';
                                                        }}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (/^\d+$/.test(val)) {
                                                                const year = new Date().getFullYear().toString().slice(-2);
                                                                setValue(`muestras.${index}.codigo_muestra_lem`, `${val}-CO-${year}`, { shouldValidate: true });
                                                            }
                                                        }}
                                                        ref={(el) => {
                                                            register(`muestras.${index}.codigo_muestra_lem`).ref(el);
                                                            if (el) {
                                                                el.style.height = 'auto';
                                                                el.style.height = el.scrollHeight + 'px';
                                                            }
                                                        }}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all resize-none leading-5 overflow-hidden ${sampleErrors?.codigo_muestra_lem ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="1483"
                                                    />
                                                </td>
                                                <td className="px-1 py-3 w-40 align-top">
                                                    <textarea
                                                        {...register(`muestras.${index}.identificacion_muestra`)}
                                                        rows={1}
                                                        onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                                        ref={(el) => { register(`muestras.${index}.identificacion_muestra`).ref(el); if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all resize-none leading-5 overflow-hidden ${sampleErrors?.identificacion_muestra ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="BD C62 (2X1)"
                                                    />
                                                </td>
                                                <td className="px-1 py-3 w-48 align-top">
                                                    <textarea
                                                        {...register(`muestras.${index}.estructura`)}
                                                        rows={1}
                                                        onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                                        ref={(el) => { register(`muestras.${index}.estructura`).ref(el); if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                                        className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all resize-none leading-5 overflow-hidden ${sampleErrors?.estructura ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                        placeholder="BANCODUCTO"
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
                                            placeholder="YYYY/MM/DD"
                                                    />
                                                </td>
                                                <td className="px-1 py-3">
                                                    <Controller
                                                        name={`muestras.${index}.hora_moldeo` as const}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <input
                                                                type="text"
                                                                value={field.value || ''}
                                                                onChange={(e) => {
                                                                    const v = e.target.value.replace(/[^\d:]/g, '');
                                                                    const digits = v.replace(/:/g, '');
                                                                    if (digits.length <= 6) {
                                                                        let formatted = '';
                                                                        for (let i = 0; i < digits.length; i++) {
                                                                            if (i === 2 || i === 4) formatted += ':';
                                                                            formatted += digits[i];
                                                                        }
                                                                        field.onChange(formatted);
                                                                    }
                                                                }}
                                                                placeholder="00:00:00"
                                                                className={`w-20 mx-auto block px-2 py-1.5 text-xs font-bold text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm transition-all ${sampleErrors?.hora_moldeo ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-100'}`}
                                                                inputMode="numeric"
                                                                maxLength={8}
                                                            />
                                                        )}
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
                                            placeholder="YYYY/MM/DD"
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
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleRequestSampleDelete(index);
                                                            }}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Eliminar muestra"
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
                                onBlur={(e) => {
                                    register('ruc').onBlur(e);
                                    setValue('ruc', normalizeRucValue(e.target.value), { shouldValidate: true });
                                }}
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
                        <div className="space-y-2">
                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Complete al menos 2 de los 3 campos siguientes:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField
                                    label="Persona Contacto:"
                                    {...register('persona_contacto')}
                                    onChange={(e) => {
                                        register('persona_contacto').onChange(e);
                                        // Sync to "Entregado por"
                                        syncEntregadoPorFromContacto(e.target.value, { force: true });
                                    }}
                                    error={errors.persona_contacto?.message}
                                    placeholder="ING. JUAN PEREZ"
                                />
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">
                                        E-mail: <span className="text-slate-400 normal-case font-bold">(uno por línea)</span>
                                    </label>
                                    <textarea
                                        {...register('email')}
                                        rows={2}
                                        className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500' : 'border-slate-200'} rounded-xl text-sm font-bold uppercase placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm text-slate-900 leading-6`}
                                        placeholder={"correo1@empresa.com\ncorreo2@empresa.com"}
                                    />
                                    {errors.email?.message && <span className="text-[9px] font-black text-red-500 uppercase ml-1">{errors.email.message}</span>}
                                </div>
                                <InputField
                                    label="Teléfono:"
                                    {...register('telefono')}
                                    error={errors.telefono?.message}
                                    placeholder="999888777"
                                />
                            </div>
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
                                placeholder="2026/02/04"
                            />
                            <InputField
                                label="FECHA ESTIMADA DE CULMINACIÓN:"
                                {...register('fecha_estimada_culminacion')}
                                onBlur={(e) => {
                                    register('fecha_estimada_culminacion').onBlur(e);
                                    handleSmartDate(e, 'fecha_estimada_culminacion');
                                }}
                                error={errors.fecha_estimada_culminacion?.message}
                                placeholder="2026/12/08"
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
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Recepción')}
                        </button>
                    </div>
                </form >
            </main >

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="¿Eliminar borrador?"
                message="Esta acción borrará todos los datos temporales no guardados. No se puede deshacer."
                confirmText="Sí, eliminar"
                cancelText="Cancelar"
                type="danger"
            />

            <ConfirmationModal
                isOpen={sampleDeleteIndex !== null}
                onClose={() => setSampleDeleteIndex(null)}
                onConfirm={handleConfirmSampleDelete}
                title="¿Eliminar muestra?"
                message="Esta acción quitará la muestra de la recepción actual. Deberá guardar la recepción para persistir el cambio."
                confirmText="Sí, eliminar"
                cancelText="Cancelar"
                type="danger"
            />

            {/* Success Modal after editing */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 transform transition-all scale-100">
                        <div className="p-8 flex flex-col items-center text-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">¡Cambios guardados!</h3>
                            <p className="text-sm text-slate-500">La recepción se actualizó correctamente.</p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 flex justify-center">
                            <button
                                onClick={() => {
                                    setIsSuccessModalOpen(false);
                                    handleClose();
                                }}
                                className="px-8 py-2.5 bg-[#0070F3] text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
