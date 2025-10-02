// API utilities for Laravel Passport authentication

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_at: string;
  refresh_token?: string;
}

class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    this.loadTokensFromStorage();
  }

  private loadTokensFromStorage() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  private saveTokensToStorage(tokens: AuthTokens) {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('token_type', tokens.token_type);
    localStorage.setItem('expires_at', tokens.expires_at);
    
    if (tokens.refresh_token) {
      localStorage.setItem('refresh_token', tokens.refresh_token);
    }

    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token || null;
  }

  private clearTokensFromStorage() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('refresh_token');
    
    this.accessToken = null;
    this.refreshToken = null;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    let data: any;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && this.refreshToken) {
        try {
          await this.refreshAccessToken();
          // Retry the original request with new token
          return this.request(response.url.replace(this.baseURL, ''), {
            method: response.url.includes('refresh') ? 'POST' : 'GET',
          });
        } catch (refreshError) {
          // Refresh failed, redirect to login
          this.clearTokensFromStorage();
          window.location.href = '/login';
          throw new Error('Authentication failed');
        }
      }

      const error = new Error(data?.message || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).data = data;
      throw error;
    }

    return data;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    return this.handleResponse<T>(response);
  }

  // Authentication methods
  async register(userData: {
    username: string;
    email: string;
    password: string;
    password_confirmation: string;
    name: string;
    device_name?: string;
  }): Promise<ApiResponse & { user: any; access_token: string }> {
    const response = await this.request<ApiResponse & AuthTokens & { user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...userData,
        device_name: userData.device_name || this.getDeviceName(),
      }),
    });

    if (response.access_token) {
      this.saveTokensToStorage({
        access_token: response.access_token,
        token_type: response.token_type || 'Bearer',
        expires_at: response.expires_at || '',
        refresh_token: response.refresh_token,
      });
    }

    return response;
  }

  async login(credentials: {
    login: string;
    password: string;
    remember_me?: boolean;
    device_name?: string;
  }): Promise<ApiResponse & { user: any; access_token: string }> {
    const response = await this.request<ApiResponse & AuthTokens & { user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...credentials,
        device_name: credentials.device_name || this.getDeviceName(),
      }),
    });

    if (response.access_token) {
      this.saveTokensToStorage({
        access_token: response.access_token,
        token_type: response.token_type || 'Bearer',
        expires_at: response.expires_at || '',
        refresh_token: response.refresh_token,
      });
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/auth/logout', {
        method: 'POST',
      });
      this.clearTokensFromStorage();
      return response;
    } catch (error) {
      // Clear tokens even if logout fails
      this.clearTokensFromStorage();
      throw error;
    }
  }

  async logoutAll(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/auth/logout-all', {
        method: 'POST',
      });
      this.clearTokensFromStorage();
      return response;
    } catch (error) {
      this.clearTokensFromStorage();
      throw error;
    }
  }

  async refreshAccessToken(): Promise<AuthTokens> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<ApiResponse & AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: this.refreshToken,
        device_name: this.getDeviceName(),
      }),
    });

    if (response.access_token) {
      this.saveTokensToStorage({
        access_token: response.access_token,
        token_type: response.token_type || 'Bearer',
        expires_at: response.expires_at || '',
        refresh_token: response.refresh_token || this.refreshToken,
      });
    }

    return response;
  }

  async getCurrentUser(): Promise<ApiResponse & { user: any }> {
    return this.request<ApiResponse & { user: any }>('/auth/me');
  }

  async updateProfile(profileData: Record<string, any>): Promise<ApiResponse & { user: any }> {
    return this.request<ApiResponse & { user: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Posts methods
  async getPosts(params: Record<string, any> = {}): Promise<ApiResponse & { posts: any[] }> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<ApiResponse & { posts: any[] }>(`/posts${queryString ? `?${queryString}` : ''}`);
  }

  async createPost(postData: Record<string, any>): Promise<ApiResponse & { post: any }> {
    return this.request<ApiResponse & { post: any }>('/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  }

  async likePost(postId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/posts/${postId}/like`, {
      method: 'POST',
    });
  }

  async unlikePost(postId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/posts/${postId}/like`, {
      method: 'DELETE',
    });
  }

  async bookmarkPost(postId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/posts/${postId}/bookmark`, {
      method: 'POST',
    });
  }

  async unbookmarkPost(postId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/posts/${postId}/bookmark`, {
      method: 'DELETE',
    });
  }

  // Messaging methods
  async getConversations(): Promise<ApiResponse & { conversations: any[] }> {
    return this.request<ApiResponse & { conversations: any[] }>('/conversations');
  }

  async getMessages(conversationId: string, params: Record<string, any> = {}): Promise<ApiResponse & { messages: any[] }> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<ApiResponse & { messages: any[] }>(`/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`);
  }

  async sendMessage(messageData: {
    conversation_id: string;
    content: string;
    type?: string;
    reply_to?: string;
  }): Promise<ApiResponse & { message: any }> {
    return this.request<ApiResponse & { message: any }>('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  // File upload methods
  async uploadProfileImage(file: File): Promise<ApiResponse & { urls: Record<string, string> }> {
    const formData = new FormData();
    formData.append('image', file);

    return this.request<ApiResponse & { urls: Record<string, string> }>('/uploads/profile-image', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        // Don't set Content-Type for FormData
      },
    });
  }

  async uploadPostMedia(files: File[]): Promise<ApiResponse & { files: any[] }> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`media[${index}]`, file);
    });

    return this.request<ApiResponse & { files: any[] }>('/uploads/post-media', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
  }

  // Utility methods
  private getDeviceName(): string {
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) return 'Android App';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS App';
    if (/Windows/i.test(userAgent)) return 'Windows App';
    if (/Mac/i.test(userAgent)) return 'Mac App';
    return 'Web App';
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // OAuth2 client management for native apps
  async getOAuthClients(): Promise<ApiResponse & { clients: any[] }> {
    return this.request<ApiResponse & { clients: any[] }>('/oauth/clients');
  }

  async createOAuthClient(clientData: {
    name: string;
    redirect: string;
  }): Promise<ApiResponse & { client: any }> {
    return this.request<ApiResponse & { client: any }>('/oauth/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  }

  async updateOAuthClient(clientId: string, clientData: {
    name: string;
    redirect: string;
  }): Promise<ApiResponse & { client: any }> {
    return this.request<ApiResponse & { client: any }>(`/oauth/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
  }

  async deleteOAuthClient(clientId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/oauth/clients/${clientId}`, {
      method: 'DELETE',
    });
  }

  // Session management
  async getSessions(): Promise<ApiResponse & { sessions: any[] }> {
    return this.request<ApiResponse & { sessions: any[] }>('/auth/sessions');
  }

  async revokeSession(tokenId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/auth/sessions/${tokenId}`, {
      method: 'DELETE',
    });
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class for custom instances
export { ApiClient };

// Export types
export type { ApiResponse, AuthTokens };
