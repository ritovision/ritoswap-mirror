// app/mint/components/Music.tsx
"use client"
import React from 'react'
import AudioWrapper from '@/components/utilities/media/audio/AudioWrapper'
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary'

export default function Music() {
  return (
    <InlineErrorBoundary component="mint-music" title="Music unavailable">
      <AudioWrapper
        headline="Crypto Music"
        imageSrc="/images/music/blockchain-4-a-Gangsta-satoshi-tupac_coverart-square.jpg"
        imageAlt="Gangsta Satoshi Tupac cover art"
        description="Everyone and their grandma wants to mint an NFT, is There a Blockchain 4 a Gangsta?"
        title="Blockchain 4 a G"
        audioSrc="/audio/blockchain4aG.mp3"
      />
    </InlineErrorBoundary>
  )
}
