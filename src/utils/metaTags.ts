/**
 * Utility functions to update meta tags for social sharing (Twitter Cards, Open Graph)
 */

export function updateMetaTags({
    title,
    description,
    image,
    url,
    type = 'website'
}: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
}) {
    // Update or create meta tags
    const setMetaTag = (property: string, content: string, isProperty = true) => {
        const attribute = isProperty ? 'property' : 'name';
        let meta = document.querySelector(`meta[${attribute}="${property}"]`);
        
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attribute, property);
            document.head.appendChild(meta);
        }
        
        meta.setAttribute('content', content);
    };

    // Update title
    if (title) {
        document.title = title;
        setMetaTag('og:title', title);
        setMetaTag('twitter:title', title, false);
    }

    // Update description
    if (description) {
        setMetaTag('og:description', description);
        setMetaTag('twitter:description', description, false);
        setMetaTag('description', description, false);
    }

    // Update image
    if (image) {
        setMetaTag('og:image', image);
        setMetaTag('twitter:image', image, false);
        setMetaTag('twitter:card', 'summary_large_image', false);
    }

    // Update URL
    if (url) {
        setMetaTag('og:url', url);
    }

    // Update type
    setMetaTag('og:type', type);
}

export function clearMetaTags() {
    // Reset to defaults
    updateMetaTags({
        title: 'Newsfeed',
        description: 'Share your moments on Newsfeed',
        image: undefined,
        url: window.location.origin,
        type: 'website'
    });
}










