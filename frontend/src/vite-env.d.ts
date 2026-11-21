/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_ROUTER?: 'hash' | 'browser'
  readonly VITE_OFFLINE?: '1'
  readonly VITE_MODEL_FILE?: string
}
