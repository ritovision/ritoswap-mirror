"use client"

import React, { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import OrbImage from "@/components/utilities/media/images/OrbImage"
import styles from "./ImageQuote.module.css"
import { applyStorybookAssetPrefix } from "@storybook-utils/assetPrefix"

interface ImageTextPair {
  image: string
  text: string
}

export default function ImageQuoteClient({
  imageTextPairs,
}: {
  imageTextPairs: ImageTextPair[]
}) {
  const [currentPair, setCurrentPair] = useState<ImageTextPair | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname() ?? ""

  // Randomly pick an image-text pair on mount AND on route changes
  // Do it asynchronously to keep render pure and satisfy ESLint
  useEffect(() => {
    let timer: number | null = null

    if (!imageTextPairs || imageTextPairs.length === 0) {
      timer = window.setTimeout(() => setCurrentPair(null), 0)
      return () => {
        if (timer) window.clearTimeout(timer)
      }
    }

    // Reset animation state
    if (containerRef.current) {
      containerRef.current.classList.remove(styles.visible)
    }

    // Small delay to ensure the class removal is processed before showing new content
    timer = window.setTimeout(() => {
      const idx = Math.floor(Math.random() * imageTextPairs.length)
      setCurrentPair(imageTextPairs[idx])
    }, 10)

    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [imageTextPairs, pathname])

  // Intersection Observer for fade-in effect
  useEffect(() => {
    const el = containerRef.current
    if (!el || !currentPair) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ; (entry.target as HTMLElement).classList.add(styles.visible)
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [pathname, currentPair])

  return (
    <div ref={containerRef} className={styles.container}>
      {currentPair ? (
        <>
          <OrbImage
            src={applyStorybookAssetPrefix(currentPair.image)}
            alt={currentPair.text || "Random visual"}
            // Let OrbImage fill the parent; parent controls width/aspect via CSS
            fill
            sizes="100vw"
            showOrbs
          />
          <div className={styles.overlay}>
            <p className={styles.text}>"{currentPair.text}"</p>
          </div>
        </>
      ) : (
        <div className={styles.placeholder}>
          <p>Loading...</p>
        </div>
      )}
    </div>
  )
}
