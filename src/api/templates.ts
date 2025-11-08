import { VideoTemplate, TemplateClip } from '../types';

// Mock storage for templates
const templates: VideoTemplate[] = [
    {
        id: 'template-1',
        name: 'opening transition',
        category: 'For You',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
        audioUrl: undefined,
        audioDuration: 3000,
        clips: [
            {
                id: 'clip-1',
                duration: 3000,
                startTime: 0,
                mediaType: 'video',
                transition: 'cut'
            }
        ],
        usageCount: 214300,
        createdAt: Date.now() - 86400000 * 7,
        isTrending: true
    },
    {
        id: 'template-2',
        name: '11PicClip Transition',
        category: 'For You',
        thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop',
        audioUrl: undefined,
        audioDuration: 8000,
        clips: Array.from({ length: 16 }, (_, i) => ({
            id: `clip-${i + 1}`,
            duration: 500,
            startTime: i * 500,
            mediaType: 'image' as const,
            transition: i === 0 ? 'cut' : 'fade' as const
        })),
        usageCount: 39200,
        createdAt: Date.now() - 86400000 * 14,
        isTrending: true
    },
    {
        id: 'template-3',
        name: 'AM I WRONG',
        category: 'Viral Song',
        thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop',
        audioUrl: undefined,
        audioDuration: 12000,
        clips: Array.from({ length: 34 }, (_, i) => ({
            id: `clip-${i + 1}`,
            duration: 350,
            startTime: i * 350,
            mediaType: 'video' as const,
            transition: i % 3 === 0 ? 'fade' : 'cut' as const
        })),
        usageCount: 14200,
        createdAt: Date.now() - 86400000 * 3,
        isTrending: false
    },
    {
        id: 'template-4',
        name: 'Mini Vlog',
        category: 'Aesthetic',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop',
        audioUrl: undefined,
        audioDuration: 15000,
        clips: Array.from({ length: 8 }, (_, i) => ({
            id: `clip-${i + 1}`,
            duration: 1875,
            startTime: i * 1875,
            mediaType: 'video' as const,
            transition: 'fade' as const
        })),
        usageCount: 8500,
        createdAt: Date.now() - 86400000 * 5,
        isTrending: false
    },
    {
        id: 'template-5',
        name: 'Meme Format',
        category: 'Meme',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=600&fit=crop',
        audioUrl: undefined,
        audioDuration: 5000,
        clips: [
            {
                id: 'clip-1',
                duration: 2000,
                startTime: 0,
                mediaType: 'image',
                transition: 'cut'
            },
            {
                id: 'clip-2',
                duration: 3000,
                startTime: 2000,
                mediaType: 'image',
                transition: 'fade'
            }
        ],
        usageCount: 125000,
        createdAt: Date.now() - 86400000 * 2,
        isTrending: true
    },
    {
        id: 'template-6',
        name: 'AI Generated',
        category: 'AI',
        thumbnailUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=600&fit=crop',
        audioUrl: undefined,
        audioDuration: 10000,
        clips: Array.from({ length: 20 }, (_, i) => ({
            id: `clip-${i + 1}`,
            duration: 500,
            startTime: i * 500,
            mediaType: 'image' as const,
            transition: 'zoom' as const
        })),
        usageCount: 45000,
        createdAt: Date.now() - 86400000 * 1,
        isTrending: true
    }
];

// Template categories
export const TEMPLATE_CATEGORIES = ['For You', 'Viral Song', 'Meme', 'AI', 'Aesthetic'];

// Mock delay function
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get all templates, optionally filtered by category
 */
export async function getTemplates(category?: string): Promise<VideoTemplate[]> {
    await delay(200);

    let filteredTemplates = [...templates];

    if (category && category !== 'For You') {
        filteredTemplates = templates.filter(t => t.category === category);
    }

    // Sort by trending first, then by usage count
    return filteredTemplates.sort((a, b) => {
        if (a.isTrending && !b.isTrending) return -1;
        if (!a.isTrending && b.isTrending) return 1;
        return b.usageCount - a.usageCount;
    });
}

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId: string): Promise<VideoTemplate | null> {
    await delay(100);

    const template = templates.find(t => t.id === templateId);
    return template || null;
}

/**
 * Get trending templates
 */
export async function getTrendingTemplates(): Promise<VideoTemplate[]> {
    await delay(150);

    return templates
        .filter(t => t.isTrending)
        .sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Increment usage count when a template is used
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
    await delay(50);

    const template = templates.find(t => t.id === templateId);
    if (template) {
        template.usageCount += 1;
    }
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(category: string): Promise<VideoTemplate[]> {
    await delay(150);

    return templates
        .filter(t => t.category === category)
        .sort((a, b) => b.usageCount - a.usageCount);
}

