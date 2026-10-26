import { getPublicWebBaseUrl } from '../utils/shareUrls';
import { parsePublicShareLink } from '../utils/publicShareLink';

/** Deep-link prefixes for WhatsApp / web share URLs opening the native app. */
export function nativeShareLinkingPrefixes(): string[] {
    const origin = getPublicWebBaseUrl();
    const prefixes = ['https://clips.app', 'https://www.clips.app'];
    if (origin && !prefixes.includes(origin)) prefixes.unshift(origin);
    return prefixes;
}

/**
 * Map a share URL onto PublicPost / PublicStory. Other paths are ignored so
 * in-app navigation is unchanged.
 */
export function getNativeShareNavState(path: string):
    | {
          routes: Array<{ name: string; params?: Record<string, string> }>;
      }
    | undefined {
    const share = parsePublicShareLink(path);
    if (share?.kind === 'post') {
        return {
            routes: [
                {
                    name: 'PublicPost',
                    params: {
                        ...(share.token ? { token: share.token } : {}),
                        ...(share.postId ? { id: share.postId } : {}),
                    },
                },
            ],
        };
    }
    if (share?.kind === 'story') {
        return {
            routes: [
                {
                    name: 'PublicStory',
                    params: { handle: share.handle, storyId: share.storyId },
                },
            ],
        };
    }
    return undefined;
}
