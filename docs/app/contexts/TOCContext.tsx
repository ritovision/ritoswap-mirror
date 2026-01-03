'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface TOCItem {
  id: string
  value: string
  depth: number
}

interface TOCContextType {
  toc: TOCItem[]
  setTOC: (toc: TOCItem[]) => void
}

const TOCContext = createContext<TOCContextType | undefined>(undefined)

export function TOCProvider({
  children,
  initialTOC = []
}: {
  children: ReactNode
  initialTOC?: TOCItem[]
}) {
  const [toc, setTOC] = useState<TOCItem[]>(initialTOC)

  return (
    <TOCContext.Provider value={{ toc, setTOC }}>
      {children}
    </TOCContext.Provider>
  )
}

export function useTOC() {
  const context = useContext(TOCContext)
  if (context === undefined) {
    throw new Error('useTOC must be used within a TOCProvider')
  }
  return context
}
