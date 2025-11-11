import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiPlus } from 'react-icons/fi';
import { getTemplates, TEMPLATE_CATEGORIES } from '../api/templates';
import { TEMPLATE_GRADIENTS, ANIMATION_DURATIONS } from '../constants';
import type { VideoTemplate } from '../types';

export default function TemplatesPage() {
    const navigate = useNavigate();
    const [templates, setTemplates] = React.useState<VideoTemplate[]>([]);
    const [selectedCategory, setSelectedCategory] = React.useState<string>('Gazetteer');
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadTemplates = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedTemplates = await getTemplates(selectedCategory);
            setTemplates(fetchedTemplates);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
            setError(errorMessage);
            console.error('Error loading templates:', err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCategory]);

    React.useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleTemplateSelect = React.useCallback((template: VideoTemplate) => {
        navigate('/template-editor', {
            state: { template }
        });
    }, [navigate]);

    // Memoize template cards to prevent unnecessary re-renders
    const TemplateCard = React.memo(({ template, onSelect }: { template: VideoTemplate; onSelect: (template: VideoTemplate) => void }) => (
        <button
            onClick={() => onSelect(template)}
            aria-label={`Select ${template.name} template`}
            className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-900 group cursor-pointer border border-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
        >
            {/* Thumbnail */}
            <div className="absolute inset-0 bg-gray-900">
                <img
                    src={template.thumbnailUrl}
                    alt={template.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('via.placeholder')) {
                            target.src = 'https://via.placeholder.com/400x600/1a1a1a/ffffff?text=' + encodeURIComponent(template.name);
                        }
                    }}
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
            </div>

            {/* Template Name */}
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold rounded">
                {template.name}
            </div>
            {/* Add symbol at bottom */}
            <div className="absolute bottom-2 right-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-full border border-white">
                <FiPlus className="w-4 h-4 text-white" />
            </div>
        </button>
    ));

    TemplateCard.displayName = 'TemplateCard';

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-gray-800">
                <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                    <h1 
                        className="text-lg font-bold text-center"
                        style={{
                            background: TEMPLATE_GRADIENTS.SILVER_WHITE,
                            backgroundSize: '200% 100%',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`
                        }}
                    >
                        Templates
                    </h1>
                    <div className="w-10"></div>
                </div>
            </div>

            {/* Templates Section */}
            <div className="max-w-md mx-auto px-4 py-6">

                {/* Category Tabs */}
                <div className="mb-6">
                    <div className="grid grid-cols-3 gap-3">
                        {TEMPLATE_CATEGORIES.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                aria-pressed={selectedCategory === category}
                                aria-label={`Filter templates by ${category}`}
                                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors text-center ${selectedCategory === category
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-gray-300'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Templates Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12" role="status" aria-label="Loading templates">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        <span className="sr-only">Loading templates...</span>
                    </div>
                ) : error ? (
                    <div className="text-center py-12 text-red-400">
                        <p role="alert">{error}</p>
                        <button
                            onClick={loadTemplates}
                            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p>No templates found in this category</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {templates.map((template) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                onSelect={handleTemplateSelect}
                            />
                        ))}
                    </div>
                )}
                
                {/* Marketing Message */}
                <p 
                    className="text-center text-sm mt-6 px-4"
                    style={{
                        background: TEMPLATE_GRADIENTS.MARKETING,
                        backgroundSize: '200% 100%',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: `shimmer ${ANIMATION_DURATIONS.SHIMMER}ms linear infinite`
                    }}
                >
                    Take your stories around the world with Gazetteer
                </p>
                
                {/* World Map */}
                <div className="mt-6 flex items-center justify-center pb-6">
                    <div className="w-full max-w-sm h-[200px] relative">
                        {/* Glow effect behind map */}
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 blur-xl rounded-2xl"></div>
                        
                        {/* World Map with modern styling */}
                        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-gray-900 to-black p-2">
                            <img
                                src="/placeholders/world-map.jpg"
                                alt="World Map"
                                className="w-full h-full object-contain"
                                style={{ 
                                    filter: 'brightness(0.95) contrast(1.2)',
                                    opacity: 0.95
                                }}
                                onError={(e) => {
                                    // Fallback to Wikimedia map
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';
                                }}
                            />
                            {/* Overlay gradient for depth */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

