import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { IoAlertCircle, IoCheckmarkCircle, IoInformationCircle } from 'react-icons/io5';

type Props = {
    visible: boolean;
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    showIcon?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    onConfirm: () => void;
    onDismiss: () => void;
};

/** Web twin of GazetteerAlertSheet.native — UCL navy bottom sheet. */
export default function GazetteerAlertSheet({
    visible,
    title,
    message,
    icon = 'alert',
    showIcon = false,
    confirmButtonText = 'Done',
    cancelButtonText = 'Cancel',
    showCancelButton = false,
    onConfirm,
    onDismiss,
}: Props) {
    const Icon = icon === 'success' ? IoCheckmarkCircle : icon === 'info' ? IoInformationCircle : IoAlertCircle;
    if (!visible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[400] flex items-end justify-center" role="presentation">
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
                initial={{ y: 28 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="relative w-[min(400px,calc(100%-32px))] overflow-hidden rounded-t-3xl border border-b-0 border-white/[0.08]"
                style={{
                    backgroundColor: '#03091B',
                    backgroundImage: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)',
                    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                }}
            >
                <div className="px-5 pt-1">
                    <div className="flex justify-center pb-2">
                        <div className="h-1 w-10 rounded-full bg-white/30" />
                    </div>
                    <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.6px] text-white">
                        Gazetteer says
                    </p>
                    {showIcon ? (
                        <div className="mb-3 flex justify-center">
                            <Icon size={44} color="#FFFFFF" aria-hidden />
                        </div>
                    ) : null}
                    <h2 className="mb-2 text-center text-lg font-semibold text-white">{title}</h2>
                    {message ? (
                        <p className="mb-5 text-center text-[15px] leading-[22px] text-[#E2E8F0]">{message}</p>
                    ) : null}
                    <button
                        type="button"
                        className="mb-2 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#03091B]"
                        onClick={onConfirm}
                    >
                        {confirmButtonText}
                    </button>
                    {showCancelButton ? (
                        <button
                            type="button"
                            className="mb-2 w-full rounded-full border border-white/[0.12] bg-white/[0.06] py-3.5 text-[15px] font-semibold text-white"
                            onClick={onDismiss}
                        >
                            {cancelButtonText}
                        </button>
                    ) : null}
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
