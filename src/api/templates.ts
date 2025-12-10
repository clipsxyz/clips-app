import { VideoTemplate } from '../types';

// Mock storage for templates
// Top templates: Gazetteer, Instagram, TikTok, YouTube Shorts
const templates: VideoTemplate[] = [
    {
        id: 'template-9',
        name: 'Gazetteer Video',
        category: 'Gazetteer',
        thumbnailUrl: '/placeholders/gazetteer-template.svg',
        audioUrl: undefined,
        audioDuration: 15000,
        clips: [
            {
                id: 'clip-1',
                duration: 15000,
                startTime: 0,
                mediaType: 'video' as const,
                transition: 'cut' as const
            }
        ],
        usageCount: 40000,
        createdAt: Date.now() + 86400000, // Future date to appear first
        isTrending: true
    },
    {
        id: 'template-7',
        name: 'Instagram Video',
        category: 'Instagram',
        thumbnailUrl: '/placeholders/instagram-template.svg',
        audioUrl: undefined,
        audioDuration: 15000,
        clips: [
            {
                id: 'clip-1',
                duration: 15000,
                startTime: 0,
                mediaType: 'video' as const,
                transition: 'cut' as const
            }
        ],
        usageCount: 50000,
        createdAt: Date.now() + 86400000, // Future date to appear first
        isTrending: true
    },
    {
        id: 'template-8',
        name: 'TikTok Video',
        category: 'TikTok',
        thumbnailUrl: '/placeholders/tiktok-template.svg',
        audioUrl: undefined,
        audioDuration: 15000,
        clips: [
            {
                id: 'clip-1',
                duration: 15000,
                startTime: 0,
                mediaType: 'video' as const,
                transition: 'cut' as const
            }
        ],
        usageCount: 45000,
        createdAt: Date.now() + 86400000, // Future date to appear first
        isTrending: true
    },
    {
        id: 'template-10',
        name: 'YouTube Shorts Video',
        category: 'YouTube Shorts',
        thumbnailUrl: '/placeholders/youtube-shorts-template.svg',
        audioUrl: undefined,
        audioDuration: 15000,
        clips: [
            {
                id: 'clip-1',
                duration: 15000,
                startTime: 0,
                mediaType: 'video' as const,
                transition: 'cut' as const
            }
        ],
        usageCount: 43000,
        createdAt: Date.now() + 86400000, // Future date to appear first
        isTrending: true
    }
];

// Template categories
export const TEMPLATE_CATEGORIES = ['Gazetteer', 'Instagram', 'TikTok', 'YouTube Shorts'];

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

    if (category && category !== 'Gazetteer') {
        filteredTemplates = templates.filter(t => t.category === category);
    }

    // Sort by trending first, then by usage count
    // Instagram, TikTok, and Gazetteer templates should always appear first
    return filteredTemplates.sort((a, b) => {
        // Instagram, TikTok, and Gazetteer templates always first
        const aIsNew = a.id === 'template-7' || a.id === 'template-8' || a.id === 'template-9';
        const bIsNew = b.id === 'template-7' || b.id === 'template-8' || b.id === 'template-9';
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;

        // Among new templates, sort by ID (Gazetteer first, then Instagram, then TikTok)
        if (aIsNew && bIsNew) {
            const order = ['template-9', 'template-7', 'template-8'];
            return order.indexOf(a.id) - order.indexOf(b.id);
        }

        // Then by trending
        if (a.isTrending && !b.isTrending) return -1;
        if (!a.isTrending && b.isTrending) return 1;

        // Then by usage count
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

