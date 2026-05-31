import { createStory } from '../api/stories';
import type { StickerOverlay, Story } from '../types';
import { notifyStoryCreated } from './storiesRefreshNative';

type TextSize = 'small' | 'medium' | 'large';

export function buildStoryComposerStickers(options: {
    caption?: string;
    location?: string;
    stickers?: StickerOverlay[];
    textColor?: string;
    textSize?: TextSize;
}): StickerOverlay[] {
    const all: StickerOverlay[] = [...(options.stickers || [])];
    const caption = options.caption?.trim();
    const location = options.location?.trim();
    const textColor = options.textColor || '#FFFFFF';
    const textSize = options.textSize || 'medium';

    if (caption) {
        const id = `text-sticker-${Date.now()}`;
        all.push({
            id,
            stickerId: id,
            sticker: {
                id,
                name: caption,
                category: 'Text',
                isTrending: false,
            },
            x: 50,
            y: 75,
            scale: textSize === 'small' ? 0.8 : textSize === 'large' ? 1.4 : 1,
            rotation: 0,
            opacity: 1,
            textContent: caption,
            textColor,
            fontSize: textSize,
        });
    }

    if (location) {
        const id = `location-sticker-${Date.now()}`;
        all.push({
            id,
            stickerId: id,
            sticker: {
                id,
                name: location,
                category: 'Location',
                isTrending: false,
            },
            x: 50,
            y: 85,
            scale: 0.9,
            rotation: 0,
            opacity: 1,
            textContent: location,
            textColor: '#FFFFFF',
            fontSize: 'small',
        });
    }

    return all;
}

export async function publishMediaStory24(options: {
    userId: string;
    userHandle: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    location?: string;
    venue?: string;
    stickers?: StickerOverlay[];
    taggedUsers?: string[];
    audience?: 'public' | 'close_friends' | 'only_me';
}): Promise<Story> {
    const composerStickers = buildStoryComposerStickers({
        caption: options.caption,
        location: options.location,
        stickers: options.stickers,
    });

    const story = await createStory(
        options.userId,
        options.userHandle,
        options.mediaUrl,
        options.mediaType,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        composerStickers.length > 0 ? composerStickers : undefined,
        options.taggedUsers?.length ? options.taggedUsers : undefined,
        undefined,
        undefined,
        undefined,
        options.venue,
        options.audience ?? 'public',
    );
    notifyStoryCreated(options.userHandle);
    return story;
}

export async function publishTextStory24(options: {
    userId: string;
    userHandle: string;
    text: string;
    location?: string;
    venue?: string;
    landmark?: string;
    taggedUsers?: string[];
    textStyle?: {
        color?: string;
        size?: TextSize;
        background?: string;
        fontFamily?: string;
    };
    audience?: 'public' | 'close_friends' | 'only_me';
}): Promise<Story> {
    const textStyle = options.textStyle;
    return createStory(
        options.userId,
        options.userHandle,
        undefined,
        undefined,
        options.text,
        options.location,
        textStyle?.color,
        textStyle?.size,
        undefined,
        undefined,
        textStyle,
        undefined,
        options.taggedUsers?.length ? options.taggedUsers : undefined,
        undefined,
        undefined,
        undefined,
        options.venue || options.landmark,
        options.audience ?? 'public',
    );
}

export async function publishPollStory24(options: {
    userId: string;
    userHandle: string;
    question: string;
    option1: string;
    option2: string;
    option3?: string;
    backgroundUri?: string;
    location?: string;
    audience?: 'public' | 'close_friends' | 'only_me';
}): Promise<Story> {
    const story = await createStory(
        options.userId,
        options.userHandle,
        options.backgroundUri,
        options.backgroundUri ? 'image' : undefined,
        undefined,
        options.location,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
            question: options.question,
            option1: options.option1,
            option2: options.option2,
            option3: options.option3,
        },
        undefined,
        undefined,
        undefined,
        options.audience ?? 'public',
    );
    notifyStoryCreated(options.userHandle);
    return story;
}
