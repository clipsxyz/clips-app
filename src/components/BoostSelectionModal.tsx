import React from 'react';
import { FiX, FiZap, FiMapPin, FiGlobe, FiTrendingUp } from 'react-icons/fi';
import type { Post } from '../types';

export type BoostFeedType = 'local' | 'regional' | 'national';

export interface BoostOption {
    type: BoostFeedType;
    label: string;
    description: string;
    price: number;
    currency: string;
    icon: React.ReactNode;
    audience: string;
}

interface BoostSelectionModalProps {
    isOpen: boolean;
    post: Post | null;
    onClose: () => void;
    onSelect: (feedType: BoostFeedType, price: number) => void;
}

const boostOptions: BoostOption[] = [
    {
        type: 'local',
        label: 'Local Newsfeed',
        description: 'Reach users in your local area',
        price: 4.99,
        currency: 'EUR',
        icon: <FiMapPin className="w-6 h-6" />,
        audience: 'Local audience'
    },
    {
        type: 'regional',
        label: 'Regional Newsfeed',
        description: 'Reach a larger regional audience',
        price: 6.99,
        currency: 'EUR',
        icon: <FiTrendingUp className="w-6 h-6" />,
        audience: 'Regional audience'
    },
    {
        type: 'national',
        label: 'National Newsfeed',
        description: 'Maximum reach across the country',
        price: 9.99,
        currency: 'EUR',
        icon: <FiGlobe className="w-6 h-6" />,
        audience: 'National audience'
    }
];

export default function BoostSelectionModal({
    isOpen,
    post,
    onClose,
    onSelect
}: BoostSelectionModalProps) {
    const [selectedOption, setSelectedOption] = React.useState<BoostFeedType | null>(null);

    if (!isOpen || !post) return null;

    const handleSelect = (option: BoostOption) => {
        setSelectedOption(option.type);
    };

    const handleSubmit = () => {
        if (selectedOption) {
            const option = boostOptions.find(o => o.type === selectedOption);
            if (option) {
                onSelect(selectedOption, option.price);
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 pt-6 pb-4 rounded-t-2xl z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                <FiZap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Boost Post</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Select a feed to boost your post. Your post will be promoted for <span className="font-semibold text-gray-900 dark:text-gray-100">6 hours</span>.
                    </p>
                </div>

                {/* Boost Options */}
                <div className="px-6 py-4 space-y-3">
                    {boostOptions.map((option) => {
                        const isSelected = selectedOption === option.type;
                        return (
                            <button
                                key={option.type}
                                onClick={() => handleSelect(option)}
                                className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${isSelected
                                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-lg scale-[1.02]'
                                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                                ? 'bg-brand-500 text-white'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        {option.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                                {option.label}
                                            </h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                                                    €{option.price.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            {option.description}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                {option.audience}
                                            </span>
                                            <span className="text-xs text-gray-400">•</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                6 hours boost
                                            </span>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                                            <svg
                                                className="w-4 h-4 text-white"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-6 py-4 rounded-b-2xl">
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedOption}
                        className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${selectedOption
                                ? 'bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-lg hover:shadow-xl active:scale-[0.98]'
                                : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                            }`}
                    >
                        Continue to Payment
                    </button>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                        Your payment is secure and encrypted
                    </p>
                </div>
            </div>
        </div>
    );
}

