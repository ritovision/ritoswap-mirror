"use client"

import React from "react"
import NextImage, { ImageProps } from "next/image"
import FloatingOrbs from "@/components/utilities/animations/FloatingOrbs"
import styles from "./OrbImage.module.css"

type OrbImageProps = Omit<ImageProps, "placeholder"> & {
  aspectRatio?: number | string
  radius?: React.CSSProperties["borderRadius"]
  showOrbs?: boolean
  orbZIndex?: number
  /** Forces the loading placeholder (orbs) to stay visible and the image to stay hidden. */
  forceLoading?: boolean
  containerClassName?: string
  /** Styles applied to the outer container div (not the image). */
  containerStyle?: React.CSSProperties
}

/**
 * OrbImage wraps next/image and shows FloatingOrbs as a loading placeholder.
 * Uses onLoad (not onLoadingComplete) to avoid deprecation warnings.
 */
export default function OrbImage({
  aspectRatio,
  radius,
  showOrbs = true,
  orbZIndex = 0,
  forceLoading = false,
  containerClassName,
  containerStyle,
  onLoad,
  onError,
  fill = true,
  sizes = "100vw",
  alt,
  ...imgProps
}: OrbImageProps) {
  const [loaded, setLoaded] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  const {
    className: imageClassName,
    style: imageStyle,
    unoptimized,
    ...restImgProps
  } = imgProps

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    if (forceLoading) return
    setLoaded(true)
    onLoad?.(e)
  }

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    if (forceLoading) return
    setErrored(true)
    onError?.(e)
  }

  const outerStyle: React.CSSProperties = {
    ...(aspectRatio
      ? {
          aspectRatio:
            typeof aspectRatio === "number" ? `${aspectRatio}` : aspectRatio,
        }
      : {}),
    borderRadius: radius,
    ...containerStyle,
  }

  return (
    <div
      className={[styles.container, containerClassName]
        .filter(Boolean)
        .join(" ")}
      style={outerStyle}
    >
      {showOrbs && (forceLoading || (!loaded && !errored)) && (
        <div className={styles.placeholder} aria-hidden>
          <FloatingOrbs className={styles.orbs} zIndex={orbZIndex} />
        </div>
      )}

      <NextImage
        {...restImgProps}
        alt={alt}
        fill={fill}
        sizes={sizes}
        unoptimized={unoptimized ?? true}
        onLoad={handleLoad}
        onError={handleError}
        className={[
          styles.image,
          forceLoading ? styles.imageHidden : loaded ? styles.imageVisible : styles.imageHidden,
          imageClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ borderRadius: radius, ...imageStyle }}
      />
    </div>
  )
}
