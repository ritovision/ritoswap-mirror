// app/portfolio/components/assets/TokenAccordionContent.tsx
'use client';

import React, { useEffect } from 'react';
import { useAssets } from '@/app/portfolio/hooks/useAssets';
import type { TokenType } from '../selection/SelectToken';
import AssetsGrid from './AssetsGrid';
import styles from './TokenAccordionContent.module.css';

interface TokenAccordionContentProps {
  chainId: number;
  tokenType: TokenType;
  address: string;
  onHover?: () => void;
}

export default function TokenAccordionContent({
  chainId,
  tokenType,
  address,
  onHover,
}: TokenAccordionContentProps) {
  const {
    assets,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useAssets({ address, chainId, tokenType });

  useEffect(() => {
    if (onHover) {
      onHover();
    }
  }, [onHover]);

  if (isError) {
    return (
      <div
        className={styles.errorState}
        role="alert"
        aria-live="assertive"
      >
        <span>{error?.message || 'Failed to load assets'}</span>
        <button
          onClick={() => refetch()}
          className={styles.retryButton}
          aria-label="Retry loading assets"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      role="region"
      aria-labelledby="token-accordion-header"
    >
      {!isLoading && assets.length > 0 && (
        <div className={styles.header}>
          <h2 id="token-accordion-header" className="sr-only">
            Assets Loaded
          </h2>
          <span
            className={styles.assetCount}
            role="status"
            aria-live="polite"
          >
            {assets.length} {assets.length === 1 ? 'Asset' : 'Assets'} Loaded
          </span>
        </div>
      )}

      <AssetsGrid assets={assets} type={tokenType} loading={isLoading} />

      {hasNextPage && !isLoading && (
        <div className={styles.loadMoreContainer}>
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className={styles.loadMoreButton}
            aria-label="Load more assets"
          >
            {isFetchingNextPage ? (
              <>
                <div className={styles.buttonSpinner} aria-hidden="true" />
                <span>Loading...</span>
              </>
            ) : (
              'Load More Assets'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
