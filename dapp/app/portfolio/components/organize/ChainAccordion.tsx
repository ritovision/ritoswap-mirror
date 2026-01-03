// app/portfolio/components/organize/ChainAccordion.tsx
'use client';

import React from 'react';
import { BigAccordion } from '@/components/utilities/accordions/BigAccordion';
import { TokenAccordion } from './TokenAccordion';
import NativeBalance from '../assets/NativeBalance';
import { TokenType } from '../selection/SelectToken';
import { useChainInfo } from '@/components/providers/ChainInfoProvider';

interface ChainAccordionProps {
  chainId: number;
  chainName: string;
  tokens: TokenType[];
  address: string;
}

/**
 * Renders an accessible accordion section for a blockchain network.
 */
export default function ChainAccordion({
  chainId,
  chainName,
  tokens,
  address,
}: ChainAccordionProps) {
  const { getChainLogoUrl } = useChainInfo();
  const logoUrl = getChainLogoUrl(chainId);

  const titleElement = (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <img
        src={logoUrl}
        alt=""                   
        aria-hidden="true"
        style={{ width: 24, height: 24, marginRight: '0.5rem' }}
      />
      <span>{chainName}</span>
    </div>
  );

  const items = [
    {
      title: titleElement,
      value: chainId.toString(),
      content: (
        <>
          <div
            role="region"
            aria-label={`Native balance for ${chainName}`}
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '1rem 0',
            }}
          >
            <NativeBalance chainId={chainId} address={address} />
          </div>
          <TokenAccordion
            chainId={chainId}
            tokenTypes={tokens}
            address={address}
          />
        </>
      ),
    },
  ];

  return (
    <section role="region" aria-label={`Assets on ${chainName}`}>
      <BigAccordion items={items} />
    </section>
  );
}
