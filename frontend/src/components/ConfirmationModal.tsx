import React from 'react';
import { X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'recepcion.geofal.com.pe dice',
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-700 transform transition-all scale-100">
                {/* Header (Mac-style dots or just title) */}
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white/90">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-base text-gray-300 font-medium">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-[#1a1a1a] flex justify-end gap-3">
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/50 hover:bg-[#4ade80]/30 rounded-full text-sm font-bold transition-all shadow-[0_0_10px_rgba(74,222,128,0.2)] hover:shadow-[0_0_15px_rgba(74,222,128,0.4)]"
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 rounded-full text-sm font-bold transition-all"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
