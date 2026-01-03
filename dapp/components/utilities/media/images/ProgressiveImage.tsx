"use client"

import React from "react"
import OrbImage from "./OrbImage"

type OrbImageProps = React.ComponentProps<typeof OrbImage>

type ProgressiveImageProps = OrbImageProps & {
  /**
   * Controls whether the animated Orb placeholder should render
   * while the underlying image is loading.
   */
  useOrbPlaceholder?: boolean
}

export default function ProgressiveImage({
  useOrbPlaceholder = true,
  ...props
}: ProgressiveImageProps) {
  return <OrbImage {...props} showOrbs={useOrbPlaceholder} />
}
