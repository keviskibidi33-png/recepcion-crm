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
                setHasSavedData(true);
                // Reset form with saved data to populate fields
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
                // console.debug(`[FormPersist] Saving data for key: ${formKey}`);
                localStorage.setItem(formKey, JSON.stringify(values));
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
