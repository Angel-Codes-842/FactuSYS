/// <reference types="vite/client" />

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

