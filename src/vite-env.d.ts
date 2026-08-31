/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly EXPO_PUBLIC_API_BASE_URL?: string
  readonly EXPO_PUBLIC_API_URL?: string
  readonly REACT_NATIVE_API_URL?: string
  readonly EXPO_PUBLIC_USE_MOCK?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}






















