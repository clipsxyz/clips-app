export type EndpointAuthExpectation = {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    auth: 'public' | 'auth';
    area: 'feed' | 'profile' | 'search' | 'create' | 'messages' | 'stories' | 'collections' | 'boost' | 'upload';
};

/**
 * Single source of truth for client-side endpoint auth expectations.
 * This helps spot drift quickly when backend middleware changes.
 */
export const ENDPOINT_AUTH_EXPECTATIONS: EndpointAuthExpectation[] = [
    { method: 'GET', path: '/health', auth: 'public', area: 'search' },
    { method: 'GET', path: '/search', auth: 'public', area: 'search' },
    { method: 'GET', path: '/search/places', auth: 'public', area: 'search' },
    { method: 'GET', path: '/locations/search', auth: 'public', area: 'search' },

    { method: 'POST', path: '/auth/register', auth: 'public', area: 'profile' },
    { method: 'POST', path: '/auth/login', auth: 'public', area: 'profile' },
    { method: 'GET', path: '/auth/me', auth: 'auth', area: 'profile' },
    { method: 'PUT', path: '/auth/profile', auth: 'auth', area: 'profile' },

    { method: 'GET', path: '/posts', auth: 'public', area: 'feed' },
    { method: 'GET', path: '/posts/{id}', auth: 'public', area: 'feed' },
    { method: 'POST', path: '/posts', auth: 'auth', area: 'create' },
    { method: 'PUT', path: '/posts/{id}', auth: 'auth', area: 'create' },
    { method: 'DELETE', path: '/posts/{id}', auth: 'auth', area: 'create' },
    { method: 'POST', path: '/posts/{id}/like', auth: 'auth', area: 'feed' },
    { method: 'POST', path: '/posts/{id}/view', auth: 'public', area: 'feed' },
    { method: 'POST', path: '/posts/{id}/share', auth: 'auth', area: 'feed' },
    { method: 'POST', path: '/posts/{id}/reclip', auth: 'auth', area: 'feed' },

    { method: 'GET', path: '/messages/conversations', auth: 'auth', area: 'messages' },
    { method: 'POST', path: '/messages/send', auth: 'auth', area: 'messages' },
    { method: 'GET', path: '/stories/paged', auth: 'auth', area: 'stories' },
    { method: 'POST', path: '/stories', auth: 'auth', area: 'stories' },
    { method: 'GET', path: '/collections', auth: 'auth', area: 'collections' },
    { method: 'POST', path: '/collections', auth: 'auth', area: 'collections' },

    { method: 'POST', path: '/boost/estimate', auth: 'public', area: 'boost' },
    { method: 'POST', path: '/boost/create-payment-intent', auth: 'public', area: 'boost' },
    { method: 'POST', path: '/boost/activate', auth: 'public', area: 'boost' },

    { method: 'POST', path: '/upload/single', auth: 'public', area: 'upload' },
];

