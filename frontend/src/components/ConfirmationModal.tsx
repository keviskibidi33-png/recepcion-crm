import React from 'react';
import { X, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';

export type ModalType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: ModalType;
    isLoading?: boolean;
}

const typeConfig = {
    danger: {
        icon: AlertTriangle,
        iconBg: 'bg-red-50',
        iconColor: 'text-red-600',
        confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
    },
    warning: {
        icon: AlertCircle,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        confirmBtn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
    },
    info: {
        icon: Info,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        confirmBtn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    },
    success: {
        icon: CheckCircle,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
    }
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirmar acción',
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'info',
    isLoading = false
}) => {
    if (!isOpen) return null;

    const config = typeConfig[type];
    const Icon = config.icon;

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300"
                onClick={!isLoading ? onClose : undefined}
            ></div>

            <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                <div className="relative transform overflow-hidden rounded-[2rem] bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="absolute right-6 top-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="px-8 pt-10 pb-8">
                        <div className="flex flex-col items-center text-center">
                            {/* Icon */}
                            <div className={`flex h-16 w-16 items-center justify-center rounded-3xl ${config.iconBg} mb-6 transition-transform duration-500 hover:scale-110`}>
                                <Icon className={`h-8 w-8 ${config.iconColor}`} />
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-xl font-bold text-slate-900 leading-tight" id="modal-title">
                                    {title}
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-8 pb-10 flex flex-col sm:flex-row-reverse gap-3">
                        <button
                            type="button"
                            className={`inline-flex items-center justify-center rounded-2xl ${config.confirmBtn} px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none w-full sm:w-auto min-w-[120px]`}
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Procesando...
                                </div>
                            ) : confirmText}
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-2xl bg-slate-50 px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all duration-200 w-full sm:w-auto border border-slate-200"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
