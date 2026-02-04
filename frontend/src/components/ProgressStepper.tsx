import React from 'react';
import {
    CurrencyDollarIcon,
    ClipboardDocumentCheckIcon,
    WrenchScrewdriverIcon,
    BeakerIcon,
    DocumentCheckIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

export type WorkflowStep = 'COTIZACION' | 'RECEPCION' | 'ORDEN_TRABAJO' | 'VERIFICACION' | 'CONTROL' | 'INFORME';

interface StepperProps {
    currentStep: WorkflowStep;
    isLockedByClient?: boolean;
}

const steps = [
    { id: 'COTIZACION', label: 'Cotización', icon: CurrencyDollarIcon },
    { id: 'RECEPCION', label: 'Recepción', icon: ClipboardDocumentCheckIcon },
    { id: 'ORDEN_TRABAJO', label: 'O. Trabajo', icon: WrenchScrewdriverIcon },
    { id: 'VERIFICACION', label: 'Verificación', icon: DocumentCheckIcon },
    { id: 'CONTROL', label: 'Control', icon: BeakerIcon },
    { id: 'INFORME', label: 'Informe', icon: CheckCircleIcon },
];

const ProgressStepper: React.FC<StepperProps> = ({ currentStep, isLockedByClient = false }) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);

    return (
        <div className="w-full py-4 px-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto">
                <div className="relative flex items-center justify-between">
                    {/* Progress Line Background */}
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0" />

                    {/* Active Progress Line */}
                    <div
                        className="absolute left-0 top-1/2 h-0.5 bg-indigo-500 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out"
                        style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
                    />

                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isCompleted = index < currentIndex;
                        const isActive = index === currentIndex;
                        const isPending = index > currentIndex;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center group">
                                {/* Step Circle */}
                                <div
                                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                     ${isCompleted ? 'bg-indigo-600 scale-90' : ''}
                    ${isActive ? 'bg-white dark:bg-gray-800 border-2 border-indigo-600 shadow-lg scale-110 ring-4 ring-indigo-50 dark:ring-indigo-900/30' : ''}
                    ${isPending ? 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400' : ''}
                  `}
                                >
                                    <Icon
                                        className={`w-6 h-6 ${isCompleted ? 'text-white' :
                                            isActive ? 'text-indigo-600' :
                                                'text-gray-400'
                                            }`}
                                    />

                                    {/* Status Indicator for locked state */}
                                    {isActive && isLockedByClient && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white animate-pulse" />
                                    )}
                                </div>

                                {/* Step Label */}
                                <span className={`
                  mt-2 text-xs font-semibold uppercase tracking-wider
                   ${isCompleted ? 'text-indigo-900 dark:text-indigo-400 opacity-80' : ''}
                  ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}
                  ${isPending ? 'text-gray-400 dark:text-gray-500' : ''}
                `}>
                                    {step.label}
                                </span>

                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {isCompleted ? 'Completado' : isActive ? 'En proceso' : 'Pendiente'}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isLockedByClient && (
                    <div className="mt-4 flex items-center justify-center bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 py-1 px-3 rounded-full mx-auto w-fit transition-all animate-bounce">
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                            ⚠️ Esperando Documentación del Cliente
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressStepper;
