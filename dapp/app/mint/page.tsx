// app/mint/page.tsx
import React from 'react'
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData from './jsonld'
import MintPageWrapper from './components/MintPageWrapper'
import Instructions from './components/Instructions/Instructions'
import Music from './components/Music'
import { mintPageMetadata } from './metadata'
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary'

export const metadata = mintPageMetadata

export default function MintPage() {
  return (
    <>
      {loadJsonLdScripts(jsonLdData, 'mint-jsonld')}
      <InlineErrorBoundary
        component="mint-wrapper"
        title="Mint page unavailable"
      >
        <MintPageWrapper />
      </InlineErrorBoundary>
      <InlineErrorBoundary
        component="mint-instructions"
        title="Instructions unavailable"
      >
        <Instructions />
      </InlineErrorBoundary>
      <div
        style={{
          width: '90%',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Music />
      </div>
    </>
  )
}
