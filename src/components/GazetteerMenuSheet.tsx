import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

export type GazetteerMenuOption = {
    label: string;
    onPress: () => void;
    destructive?: boolean;
    icon?: React.ReactNode;
};

type Props = {
    visible: boolean;
    title: string;
    subtitle?: string;
    options: GazetteerMenuOption[];
    cancelLabel?: string;
    onDismiss: () => void;
};

/** Web twin of GazetteerMenuSheet.native — UCL navy sheet, “Gazetteer says”. */
export default function GazetteerMenuSheet({
    visible,
    title,
    subtitle,
    options,
    cancelLabel = 'Cancel',
    onDismiss,
}: Props) {
    if (!visible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center" role="presentation">
            <button
                type="button"
                aria-label="Dismiss"
                className="absolute inset-0 bg-black/72"
                onClick={onDismiss}
            />
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="relative max-h-[78%] w-[min(400px,calc(100%-32px))] overflow-hidden rounded-t-3xl border border-b-0 border-white/[0.12]"
                style={{
                    backgroundColor: '#03091B',
                    backgroundImage: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)',
                    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                }}
            >
                <div className="px-5 pt-1">
                    <div className="flex justify-center pb-2">
                        <div className="h-1 w-10 rounded-full bg-white" />
                    </div>
                    <p className="mb-2.5 text-center text-xs font-semibold uppercase tracking-[0.6px] text-white">
                        Gazetteer says
                    </p>
                    <h2 className="mb-1.5 text-center text-lg font-semibold text-white">{title}</h2>
                    {subtitle ? (
                        <p className="mb-3 text-center text-sm leading-5 text-[#E2E8F0]">{subtitle}</p>
                    ) : null}
                    <div className="mb-2 max-h-80 overflow-y-auto">
                        {options.map((option, index) => (
                            <button
                                key={`${index}-${option.label}`}
                                type="button"
                                className={`mb-2.5 flex w-full items-center gap-2.5 rounded-[14px] border border-white/[0.12] bg-white/[0.06] px-4 py-[15px] ${
                                    option.icon ? 'justify-start' : 'justify-center'
                                }`}
                                onClick={() => {
                                    option.onPress();
                                    onDismiss();
                                }}
                            >
                                {option.icon ? (
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.12] text-white">
                                        {option.icon}
                                    </span>
                                ) : null}
                                <span
                                    className={`text-[15px] font-semibold ${
                                        option.destructive ? 'text-[#F87171]' : 'text-white'
                                    } ${option.icon ? 'text-left' : 'text-center'}`}
                                >
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="mt-1 w-full rounded-full border border-white/[0.12] bg-white/[0.06] py-3.5 text-[15px] font-semibold text-white"
                        onClick={onDismiss}
                    >
                        {cancelLabel}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
