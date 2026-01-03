'use client';
import React from 'react';
import AudioWrapper from '@components/media/audio/AudioWrapper';

export default function CryptoMusicSection() {
  return (
    <AudioWrapper
  headline="Crypto Music"
  imageSrc="/images/music/altcoin-love-coverart-square.jpg"
  imageAlt="Altcoin Love Cover Art"
  description={
    <>
      An anthemic ode to altcoins by Rito Rhymes… <em>California Love</em> style
    </>
  }
  title="Altcoin Love"
  audioSrc="/audio/Altcoin_Love.mp3"
/>

  );
}
