// Privacy management using localStorage (matching app's localStorage pattern)
import type { User } from '../types';

// Store user privacy settings in localStorage
const PRIVACY_STORAGE_KEY = 'user_privacy_settings';
const FOLLOW_REQUESTS_KEY = 'follow_requests';

interface PrivacySettings {
  [handle: string]: boolean; // handle -> is_private
}

interface FollowRequest {
  fromHandle: string;
  toHandle: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'denied';
}

// Get privacy settings from localStorage
function getPrivacySettings(): PrivacySettings {
  try {
    const stored = localStorage.getItem(PRIVACY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save privacy settings to localStorage
function savePrivacySettings(settings: PrivacySettings): void {
  localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(settings));
}

// Get follow requests from localStorage
export function getFollowRequests(): FollowRequest[] {
  try {
    const stored = localStorage.getItem(FOLLOW_REQUESTS_KEY);
    const requests = stored ? JSON.parse(stored) : [];
    
    // Filter out any invalid requests (safety check)
    const validRequests = requests.filter((req: any) => 
      req && 
      typeof req.fromHandle === 'string' && 
      typeof req.toHandle === 'string' && 
      req.status === 'pending'
    );
    
    // If we filtered out invalid requests, save the cleaned list
    if (validRequests.length !== requests.length) {
      saveFollowRequests(validRequests);
    }
    
    return validRequests;
  } catch (error) {
    console.error('Error reading follow requests from localStorage:', error);
    return [];
  }
}

// Save follow requests to localStorage
function saveFollowRequests(requests: FollowRequest[]): void {
  localStorage.setItem(FOLLOW_REQUESTS_KEY, JSON.stringify(requests));
}

// Initialize mock users with different privacy settings (for testing)
export function initializePrivateMockUser(): void {
  // Set Sarah@Artane as a private profile user for testing
  setProfilePrivacy('Sarah@Artane', true);
  
  // Set multiple users as public for testing (so you have options to test public DM access)
  // These users exist in posts.json and can be used to test public DM access
  setProfilePrivacy('Username@Dublin', false);
  setProfilePrivacy('Alice@Finglas', false);
  setProfilePrivacy('Bob@Ireland', false);
  setProfilePrivacy('Sarah@NewYork', false);
  setProfilePrivacy('Mike@London', false);
  setProfilePrivacy('Emma@Paris', false);
  setProfilePrivacy('John@Tokyo', false);
  setProfilePrivacy('Lisa@Sydney', false);
}

// Check if a user's profile is private
export function isProfilePrivate(handle: string): boolean {
  const settings = getPrivacySettings();
  return settings[handle] === true;
}

// Set profile privacy
export function setProfilePrivacy(handle: string, isPrivate: boolean): void {
  const settings = getPrivacySettings();
  settings[handle] = isPrivate;
  savePrivacySettings(settings);
}

// Check if user can view a profile
export function canViewProfile(viewerHandle: string, profileHandle: string, viewerFollows: string[]): boolean {
  // Users can always view their own profile
  if (viewerHandle === profileHandle) {
    return true;
  }

  // If profile is not private, anyone can view
  if (!isProfilePrivate(profileHandle)) {
    return true;
  }

  // If profile is private, only followers can view
  return viewerFollows.includes(profileHandle);
}

// Check if user can send message
export function canSendMessage(senderHandle: string, recipientHandle: string, senderFollows: string[]): boolean {
  // Users can't message themselves
  if (senderHandle === recipientHandle) {
    return false;
  }

  // If profile is not private, anyone can message
  if (!isProfilePrivate(recipientHandle)) {
    return true;
  }

  // If profile is private, only followers can message
  return senderFollows.includes(recipientHandle);
}

// Check if there's a pending follow request
export function hasPendingFollowRequest(fromHandle: string, toHandle: string): boolean {
  if (!fromHandle || !toHandle) {
    console.warn('hasPendingFollowRequest: Invalid parameters', { fromHandle, toHandle });
    return false;
  }
  
  const requests = getFollowRequests();
  // Filter out any requests older than 30 days (stale cleanup)
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const validRequests = requests.filter(req => {
    // Remove stale requests older than 30 days
    if (req.timestamp && req.timestamp < thirtyDaysAgo) {
      return false;
    }
    return true;
  });
  
  // If we filtered out stale requests, save the cleaned list
  if (validRequests.length !== requests.length) {
    saveFollowRequests(validRequests);
  }
  
  const matchingRequests = validRequests.filter(
    req => req.fromHandle === fromHandle && req.toHandle === toHandle && req.status === 'pending'
  );
  const hasPending = matchingRequests.length > 0;
  
  // Debug logging
  console.log('hasPendingFollowRequest: Check result', {
    fromHandle,
    toHandle,
    hasPending,
    matchingRequests: matchingRequests.length,
    totalValidRequests: validRequests.length,
    allRequests: validRequests.map(r => ({ from: r.fromHandle, to: r.toHandle, status: r.status, age: r.timestamp ? Math.floor((now - r.timestamp) / (1000 * 60 * 60 * 24)) + ' days' : 'unknown' }))
  });
  
  return hasPending;
}

// Create a follow request
export function createFollowRequest(fromHandle: string, toHandle: string): void {
  const requests = getFollowRequests();
  // Remove any existing request
  const filtered = requests.filter(
    req => !(req.fromHandle === fromHandle && req.toHandle === toHandle)
  );
  
  const newRequest = {
    fromHandle,
    toHandle,
    timestamp: Date.now(),
    status: 'pending' as const
  };
  
  filtered.push(newRequest);
  
  console.log('createFollowRequest: Creating new follow request', {
    fromHandle,
    toHandle,
    newRequest,
    totalRequests: filtered.length
  });
  
  saveFollowRequests(filtered);
}

// Accept a follow request
export function acceptFollowRequest(fromHandle: string, toHandle: string): void {
  const requests = getFollowRequests();
  const updated = requests.map(req => {
    if (req.fromHandle === fromHandle && req.toHandle === toHandle && req.status === 'pending') {
      return { ...req, status: 'accepted' as const };
    }
    return req;
  });
  saveFollowRequests(updated);
}

// Deny a follow request
export function denyFollowRequest(fromHandle: string, toHandle: string): void {
  const requests = getFollowRequests();
  const filtered = requests.filter(
    req => !(req.fromHandle === fromHandle && req.toHandle === toHandle && req.status === 'pending')
  );
  saveFollowRequests(filtered);
}

// Get pending follow requests for a user
export function getPendingFollowRequests(handle: string): FollowRequest[] {
  const requests = getFollowRequests();
  return requests.filter(req => req.toHandle === handle && req.status === 'pending');
}

// Remove follow request (when user follows directly or unfollows)
export function removeFollowRequest(fromHandle: string, toHandle: string): void {
  const requests = getFollowRequests();
  const filtered = requests.filter(
    req => !(req.fromHandle === fromHandle && req.toHandle === toHandle)
  );
  console.log('removeFollowRequest: Removed follow request', {
    fromHandle,
    toHandle,
    removedCount: requests.length - filtered.length,
    remainingRequests: filtered.length
  });
  saveFollowRequests(filtered);
}

// Clear all follow requests (for debugging/testing)
export function clearAllFollowRequests(): void {
  console.log('clearAllFollowRequests: Clearing all follow requests');
  saveFollowRequests([]);
}

// Clear stale follow requests (older than specified hours, default 1 hour)
export function clearStaleFollowRequests(maxAgeHours: number = 1): number {
  const requests = getFollowRequests();
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  const validRequests = requests.filter(req => {
    if (req.timestamp && req.timestamp < (now - maxAge)) {
      return false; // Stale request
    }
    return true;
  });
  
  const removedCount = requests.length - validRequests.length;
  if (removedCount > 0) {
    console.log(`clearStaleFollowRequests: Removed ${removedCount} stale follow requests (older than ${maxAgeHours} hour(s))`);
    saveFollowRequests(validRequests);
  }
  
  return removedCount;
}





