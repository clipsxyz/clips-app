import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiPlus, FiVolume2 } from 'react-icons/fi';
import { getTemplates, TEMPLATE_CATEGORIES } from '../api/templates';
import type { VideoTemplate } from '../types';

export default function TemplatesPage() {
    const navigate = useNavigate();
    const [templates, setTemplates] = React.useState<VideoTemplate[]>([]);
    const [selectedCategory, setSelectedCategory] = React.useState<string>('For You');
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        loadTemplates();
    }, [selectedCategory]);

    async function loadTemplates() {
        setIsLoading(true);
        try {
            const fetchedTemplates = await getTemplates(selectedCategory);
            setTemplates(fetchedTemplates);
        } catch (error) {
            console.error('Error loading templates:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function formatUsageCount(count: number): string {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M videos`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K videos`;
        }
        return `${count} videos`;
    }

    function handleTemplateSelect(template: VideoTemplate) {
        navigate('/template-editor', {
            state: { template }
        });
    }

    function handleCreateNew() {
        // Navigate to create page without template
        navigate('/create');
    }

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
                    <h1 className="text-lg font-bold uppercase tracking-wide">CREATE</h1>
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-1.5 bg-white text-black rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                        <FiPlus className="w-4 h-4" />
                        <span>New</span>
                    </button>
                </div>
            </div>

            {/* Templates Section */}
            <div className="max-w-md mx-auto px-4 py-6">
                <h2 className="text-2xl font-bold mb-4">Templates</h2>

                {/* Category Tabs */}
                <div className="mb-6 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-4 pb-2">
                        {TEMPLATE_CATEGORIES.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === category
                                        ? 'text-white border-b-2 border-white'
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
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p>No templates found in this category</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {templates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => handleTemplateSelect(template)}
                                className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-900 group cursor-pointer"
                            >
                                {/* Thumbnail */}
                                <div className="absolute inset-0">
                                    <img
                                        src={template.thumbnailUrl}
                                        alt={template.name}
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Video indicator */}
                                    {template.clips.some(c => c.mediaType === 'video') && (
                                        <div className="absolute bottom-2 right-2 p-1.5 bg-black/60 rounded-full">
                                            <FiVolume2 className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                                </div>

                                {/* Template Info */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                    <div className="text-white font-semibold text-sm mb-1 line-clamp-1">
                                        {template.name}
                                    </div>
                                    <div className="text-gray-300 text-xs">
                                        {formatUsageCount(template.usageCount)} • {template.clips.length} {template.clips.length === 1 ? 'clip' : 'clips'}
                                    </div>
                                </div>

                                {/* Trending Badge */}
                                {template.isTrending && (
                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded">
                                        Trending
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

