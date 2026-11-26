"use client"

import * as React from "react"
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from '../../tailwind.config'

const fullConfig = resolveConfig(tailwindConfig)
const screens = fullConfig.theme.screens as { [key: string]: string }
const mdBreakpoint = parseInt(screens.md, 10);


export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    const mql = window.matchMedia(`(max-width: ${mdBreakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < mdBreakpoint)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < mdBreakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
