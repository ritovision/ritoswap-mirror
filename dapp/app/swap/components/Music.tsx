// app/swap/components/Music.tsx
import React from 'react';
import AudioWrapper from '@components/utilities/media/audio/AudioWrapper';
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary';

export default function Music() {
  return (
    <InlineErrorBoundary component="swap-music" title="Music unavailable">
      <AudioWrapper
        headline="Crypto Music"
        imageSrc="/images/music/A-Trillie-Coverart-square.jpg"
        imageAlt="A Trillie cover art"
        description="Not financial advice. Trade at your own risk. But do enjoy some Rito Rhymes turning a milli into a trillie."
        title="A Trillie"
        audioSrc="/audio/A-Trillie.mp3"
      />
    </InlineErrorBoundary>
  );
}
