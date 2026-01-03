import { useEffect, useState } from 'react'
import type { TOCItem } from '@Contexts/TOCContext'

interface UseActiveHeadingOptions {
  toc: TOCItem[] | undefined
  enabled: boolean
}

export function useActiveHeading({ toc, enabled }: UseActiveHeadingOptions) {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (!enabled || !toc || typeof window === 'undefined') return

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) setActiveId(entry.target.id)
              })
            },
            { rootMargin: '-80px 0px -80% 0px' }
          )
        : null

    if (!observer) return

    toc.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [enabled, toc])

  return activeId
}
