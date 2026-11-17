import { apiRequest } from './client';
import type { ProfilePostNotifyLevel } from '../utils/profilePostNotifyPrefs';

export async function fetchProfilePostNotifyLevel(handle: string): Promise<ProfilePostNotifyLevel> {
    const data = await apiRequest(`/users/${encodeURIComponent(handle)}/post-notifications`);
    return data?.level === 'all' ? 'all' : 'off';
}

export async function saveProfilePostNotifyLevel(handle: string, level: ProfilePostNotifyLevel): Promise<void> {
    await apiRequest(`/users/${encodeURIComponent(handle)}/post-notifications`, {
        method: 'PUT',
        body: JSON.stringify({ level }),
    });
}
