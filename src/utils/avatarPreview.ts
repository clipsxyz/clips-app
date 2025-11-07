/**
 * Avatar Preview Generator
 * Generates preview images for avatar selection UI
 * 
 * NOTE: Currently using placeholder images. Replace with your high-quality cartoon avatar images
 * to match your vision. See AVATAR_QUALITY_IMPROVEMENT.md for details.
 */

/**
 * Generate a preview image for an avatar
 * Uses placeholder images until high-quality avatar assets are added
 */
export async function generateAvatarPreview(
    avatarId: string,
    width: number = 200,
    height: number = 200
): Promise<string> {
    // For now, use placeholder images that match the vision
    // TODO: Replace with actual high-quality avatar images
    const placeholderImages: Record<string, string> = {
        avatar1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face', // Happy Guy placeholder
        avatar2: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face', // Cool Dude placeholder
        avatar3: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face', // Energetic placeholder
        avatar4: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face', // Happy Girl placeholder
        avatar5: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face', // Cool Girl placeholder
    };

    // Return placeholder URL for now
    // In production, you'll replace these with your actual high-quality cartoon avatar images
    return placeholderImages[avatarId] || placeholderImages.avatar1;
}

/**
 * Avatar configuration with preview info
 */
export interface AvatarConfig {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    description: string;
    previewUrl?: string; // Will be generated if not provided
}

/**
 * Available avatars with descriptions
 */
export const avatarConfigs: AvatarConfig[] = [
    {
        id: 'avatar1',
        name: 'Happy Guy',
        gender: 'male',
        description: 'Friendly and cheerful character with curly brown hair and orange hoodie',
    },
    {
        id: 'avatar2',
        name: 'Cool Dude',
        gender: 'male',
        description: 'Stylish character with a laid-back attitude',
    },
    {
        id: 'avatar3',
        name: 'Energetic',
        gender: 'male',
        description: 'High-energy character perfect for exciting moments',
    },
    {
        id: 'avatar4',
        name: 'Happy Girl',
        gender: 'female',
        description: 'Bright and cheerful character with a warm smile',
    },
    {
        id: 'avatar5',
        name: 'Cool Girl',
        gender: 'female',
        description: 'Confident and stylish character',
    },
];

/**
 * Generate previews for all avatars
 */
export async function generateAllAvatarPreviews(): Promise<Record<string, string>> {
    const previews: Record<string, string> = {};

    for (const config of avatarConfigs) {
        try {
            previews[config.id] = await generateAvatarPreview(config.id);
        } catch (error) {
            console.error(`Failed to generate preview for ${config.id}:`, error);
        }
    }

    return previews;
}

