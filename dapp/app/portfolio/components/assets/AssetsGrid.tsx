// app/portfolio/components/assets/AssetsGrid.tsx
'use client';

import React from 'react';
import AssetDisplay, { NFTAsset, ERC20Asset } from './AssetDisplay';
import styles from './AssetsGrid.module.css';

interface AssetsGridProps {
  assets: (NFTAsset | ERC20Asset)[];
  type: 'ERC-20' | 'ERC-721' | 'ERC-1155';
  loading?: boolean;
}

export default function AssetsGrid({ assets, type, loading }: AssetsGridProps) {
  if (loading) {
    return (
      <div
        className={styles.loadingContainer}
        role="status"
        aria-live="polite"
      >
        <div className={styles.spinner} aria-hidden="true" />
        <span>Loading assets...</span>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div
        className={styles.emptyState}
        role="status"
        aria-live="polite"
      >
        No Assets Found!
      </div>
    );
  }

  return (
    <div
      className={styles.grid}
      role="grid"
      aria-label={`${type} assets grid`}
    >
      {assets.map((asset, index) => {
        const key = `${asset.contractAddress}-${
          'tokenId' in asset ? asset.tokenId : index
        }`;
        return (
          <div role="row" key={key}>
            <div role="gridcell">
              <AssetDisplay asset={asset} type={type} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
