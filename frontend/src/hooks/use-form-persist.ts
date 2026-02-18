import { useEffect, useCallback, useState } from 'react';
import { UseFormReturn, FieldValues, DefaultValues } from 'react-hook-form';

/**
 * Hook to persist form data to localStorage
 * @param formKey Unique key for localStorage
 * @param formMethods react-hook-form methods object
 * @param enabled Whether persistence is enabled
 */
export function useFormPersist<T extends FieldValues>(
    formKey: string,
    formMethods: UseFormReturn<T>,
    enabled: boolean = true
) {
    const { watch, reset } = formMethods;
    const values = watch();
    const [hasSavedData, setHasSavedData] = useState(false);

    // Initial load - Only run once on mount or when key/enabled changes
    useEffect(() => {
        if (!enabled) return;

        const savedData = localStorage.getItem(formKey);
        if (savedData) {
            try {
                console.debug(`[FormPersist] Loading saved data for key: ${formKey}`);
                const parsed = JSON.parse(savedData);

                // Sanitize muestras array: remove ghost/empty entries
                // A muestra is considered empty if it lacks both identificacion_muestra and fecha_moldeo
                if (Array.isArray(parsed.muestras)) {
                    const originalCount = parsed.muestras.length;
                    parsed.muestras = parsed.muestras.filter((m: any) => {
                        if (!m) return false;
                        const hasIdentificacion = m.identificacion_muestra && String(m.identificacion_muestra).trim() !== '';
                        const hasFechaMoldeo = m.fecha_moldeo && String(m.fecha_moldeo).trim() !== '';
                        const hasFc = m.fc_kg_cm2 !== undefined && m.fc_kg_cm2 !== null && String(m.fc_kg_cm2).trim() !== '';
                        const hasEdad = m.edad !== undefined && m.edad !== null && String(m.edad).trim() !== '';
                        // A muestra must have identification AND at least one data field to be kept
                        return (hasIdentificacion || hasFechaMoldeo) && (hasFc || hasEdad || hasFechaMoldeo);
                    });
                    // Ensure at least one empty muestra exists for new forms
                    if (parsed.muestras.length === 0) {
                        parsed.muestras = [{
                            identificacion_muestra: '',
                            estructura: '',
                            fc_kg_cm2: '',
                            edad: '',
                            requiere_densidad: '',
                            fecha_moldeo: '',
                            hora_moldeo: '',
                            fecha_rotura: '',
                            codigo_muestra_lem: ''
                        }];
                    }
                    if (parsed.muestras.length !== originalCount) {
                        console.debug(`[FormPersist] Removed ${originalCount - parsed.muestras.length} ghost muestra(s)`);
                    }
                }

                setHasSavedData(true);
                // Reset form with sanitized data to populate fields
                reset(parsed as DefaultValues<T>);
            } catch (e) {
                console.error('Error loading saved form data:', e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formKey, enabled]);

    // Save on change (debounced)
    useEffect(() => {
        if (!enabled) return;

        const timeoutId = setTimeout(() => {
            if (Object.keys(values).length > 0) {
                const toSave = { ...values };
                // Sanitize muestras before saving to prevent ghost entries
                if (Array.isArray((toSave as any).muestras)) {
                    (toSave as any).muestras = (toSave as any).muestras.filter((m: any) => {
                        if (!m) return false;
                        const hasIdentificacion = m.identificacion_muestra && String(m.identificacion_muestra).trim() !== '';
                        const hasFechaMoldeo = m.fecha_moldeo && String(m.fecha_moldeo).trim() !== '';
                        const hasFc = m.fc_kg_cm2 !== undefined && m.fc_kg_cm2 !== null && String(m.fc_kg_cm2).trim() !== '';
                        const hasEdad = m.edad !== undefined && m.edad !== null && String(m.edad).trim() !== '';
                        return (hasIdentificacion || hasFechaMoldeo) && (hasFc || hasEdad || hasFechaMoldeo);
                    });
                    // Keep at least one empty entry so the form isn't blank on restore
                    if ((toSave as any).muestras.length === 0) {
                        (toSave as any).muestras = [(values as any).muestras[0] || {}];
                    }
                }
                localStorage.setItem(formKey, JSON.stringify(toSave));
                setHasSavedData(true);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [values, formKey, enabled]);

    const clearSavedData = useCallback(() => {
        localStorage.removeItem(formKey);
        setHasSavedData(false);
    }, [formKey]);

    return {
        clearSavedData,
        hasSavedData
    };
}
