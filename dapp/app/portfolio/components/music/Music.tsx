import React from 'react';
import AudioWrapper from '@components/utilities/media/audio/AudioWrapper';
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary';

export default function Music() {
  return (
    <InlineErrorBoundary component="portfolio-music" title="Music unavailable">
      <AudioWrapper
        headline="Crypto Music"
        imageSrc="/images/music/hodeler-coverart-square.jpg"
        imageAlt="Hodeler cover art"
        description="Rito ain't saying she a hodeler, but she sure as hell ain't no broke coder."
        title="Hodeler"
        audioSrc="/audio/Hodeler.mp3"
      />
    </InlineErrorBoundary>
  );
}
