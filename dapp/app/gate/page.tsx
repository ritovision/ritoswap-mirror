// app/gate/page.tsx
import React from 'react'
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex'
import jsonLdData from './jsonld'
import GatePageWrapper from './components/GatePageWrapper'
import { gatePageMetadata } from './metadata'

export const metadata = gatePageMetadata

export default function GatePage() {
  return (
    <>
      {loadJsonLdScripts(jsonLdData, 'gate-jsonld')}
      <GatePageWrapper />
    </>
  )
}
