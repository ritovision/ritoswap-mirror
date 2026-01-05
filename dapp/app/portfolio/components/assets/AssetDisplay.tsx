// app/portfolio/components/assets/AssetDisplay.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import styles from './AssetDisplay.module.css';
import ProgressiveImage from '@/components/utilities/media/images/ProgressiveImage';

export interface NFTAsset {
  tokenId: string;
  contractAddress: string;
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  balance?: string; // for ERC-1155
}

export interface ERC20Asset {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string; // hex or decimal string
  logo?: string;
  price?: number;
}

type Asset = NFTAsset | ERC20Asset;

interface AssetDisplayProps {
  asset: Asset;
  type: 'ERC-20' | 'ERC-721' | 'ERC-1155';
}

function isERC20(asset: Asset): asset is ERC20Asset {
  return 'symbol' in asset && 'decimals' in asset;
}

export default function AssetDisplay({ asset }: AssetDisplayProps) {
  const [imageOrientation, setImageOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let img: HTMLImageElement | null = null;

    if (!isERC20(asset) && asset.image && !imageError) {
      img = new Image();

      img.onload = () => {
        setImageOrientation(img!.width > img!.height ? 'landscape' : 'portrait');
      };

      img.onerror = () => {
        setImageError(true);
      };

      img.src = asset.image;
    }

    return () => {
      if (img) {
        // Cancel any pending load
        img.onload = null;
        img.onerror = null;
        img.src = '';
        img = null;
      }
    };
  }, [asset, imageError]);

  if (isERC20(asset)) {
    return <ERC20Display asset={asset} />;
  }

  return (
    <NFTDisplay
      asset={asset}
      orientation={imageOrientation}
      imageError={imageError}
      onImageError={() => setImageError(true)}
    />
  );
}

function ERC20Display({ asset }: { asset: ERC20Asset }) {
  const [logoFailed, setLogoFailed] = useState(!asset.logo);

  useEffect(() => {
    setLogoFailed(!asset.logo);
  }, [asset.logo]);
  const formatBalance = (balance: string, decimals: number) => {
    const rawStr = formatUnits(BigInt(balance), decimals);
    const raw = parseFloat(rawStr);
    if (!raw) return '0.00000';
    let result = raw.toPrecision(16);
    if (result.includes('e')) {
      const intPart = Math.floor(raw).toString();
      const maxDecimals = Math.max(0, 16 - intPart.length - 1);
      result = raw.toFixed(maxDecimals);
    }
    if (result.includes('.')) result = result.replace(/\.?0+$/, '');
    if (result.startsWith('.')) result = '0' + result;
    return result;
  };

  const numericBalance = formatBalance(asset.balance, asset.decimals);
  const value = asset.price
    ? `$${(asset.price * parseFloat(formatUnits(BigInt(asset.balance), asset.decimals))).toFixed(2)}`
    : null;

  return (
    <section
      className={styles.assetContainer}
      role="region"
      aria-label={`${asset.name} (${asset.symbol})`}
    >
      <div className={styles.erc20Header}>
        {asset.logo && !logoFailed ? (
          <div className={styles.tokenLogoWrapper}>
            <ProgressiveImage
              src={asset.logo}
              alt={asset.symbol}
              width={40}
              height={40}
              fill={false}
              className={styles.tokenLogo}
              containerClassName={styles.tokenLogoWrapper}
              useOrbPlaceholder
              onError={() => setLogoFailed(true)}
            />
          </div>
        ) : (
          <div
            className={styles.tokenLogoPlaceholder}
            role="img"
            aria-label={`${asset.symbol} logo placeholder`}
          >
            <span aria-hidden="true">
              {asset.symbol.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className={styles.tokenInfo}>
          <h3 className={styles.tokenName}>{asset.name}</h3>
          <span className={styles.tokenSymbol}>{asset.symbol}</span>
        </div>
      </div>
      <div className={styles.tokenDetails}>
        <div className={styles.balance} role="status" aria-live="polite">
          <span className={styles.label}>Balance:&nbsp;</span>
          <span className={styles.value}>{numericBalance}</span>
        </div>
        {value && (
          <div className={styles.value} role="status" aria-live="polite">
            <span className={styles.label}>Value:&nbsp;</span>
            <span className={styles.value}>{value}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function NFTDisplay({
  asset,
  orientation,
  imageError,
  onImageError,
}: {
  asset: NFTAsset;
  orientation: 'landscape' | 'portrait';
  imageError: boolean;
  onImageError: () => void;
}) {
  const titleId = `nft-${asset.tokenId}-title`;
  const descId = asset.description ? `${titleId}-description` : undefined;
  const shouldShowImage = !!asset.image && !imageError;

  return (
    <section
      className={styles.assetContainer}
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className={`${styles.imageContainer} ${styles[orientation]}`}
        role="img"
        aria-label={asset.name || `Token #${asset.tokenId} image`}
      >
        {shouldShowImage ? (
          <ProgressiveImage
            src={asset.image ?? ''}
            alt={asset.name || `Token #${asset.tokenId}`}
            className={styles.assetImage}
            sizes="(max-width: 768px) 90vw, 400px"
            useOrbPlaceholder={false}
            onError={onImageError}
          />
        ) : (
          <div
            className={styles.noImage}
            role="img"
            aria-label="No image available"
          >
            <span aria-hidden="true">No Image</span>
            {imageError && (
              <span
                role="alert"
                style={{ fontSize: '10px', marginTop: '4px' }}
              >
                Failed to load
              </span>
            )}
          </div>
        )}
      </div>
      <div className={styles.infoContainer}>
        <h3 id={titleId} className={styles.assetName}>
          {asset.name || `Token #${asset.tokenId}`}
        </h3>
        {asset.balance && (
          <span className={styles.assetBalance}>
            Balance: {asset.balance}
          </span>
        )}
        {asset.description && (
          <p id={descId} className={styles.assetDescription}>
            {asset.description}
          </p>
        )}
        {asset.attributes && asset.attributes.length > 0 && (
          <div
            className={styles.attributes}
            role="list"
            aria-label="Attributes"
          >
            {asset.attributes.slice(0, 4).map((attr, idx) => (
              <div key={idx} className={styles.attribute} role="listitem">
                <span className={styles.traitType}>{attr.trait_type}:</span>
                <span className={styles.traitValue}>{attr.value}</span>
              </div>
            ))}
            {asset.attributes.length > 4 && (
              <span
                className={styles.moreAttributes}
                aria-label={`+${asset.attributes.length - 4} more attributes`}
                aria-live="polite"
              >
                +{asset.attributes.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
