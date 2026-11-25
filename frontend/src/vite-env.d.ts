/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'legacy' | 'supabase'
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@mui/icons-material/*' {
  import { SvgIconProps } from '@mui/material/SvgIcon'
  import { ComponentType } from 'react'
  const Component: ComponentType<SvgIconProps>
  export default Component
}

declare module 'jsbarcode' {
  const jsbarcode: any
  export default jsbarcode
}
