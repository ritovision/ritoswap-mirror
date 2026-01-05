// app/portfolio/components/assets/NativeBalance.tsx
'use client';

import React from 'react';
import { useBalance, useConfig } from 'wagmi';
import { formatEther } from 'viem';
import styles from './NativeBalance.module.css';

interface NativeBalanceProps {
  chainId: number;
  address: string;
}

export default function NativeBalance({ chainId, address }: NativeBalanceProps) {
  const { chains } = useConfig();
  const chain = chains.find(c => c.id === chainId);

  const { data, isError, isLoading } = useBalance({
    address: address as `0x${string}`,
    chainId,
  });

  if (isLoading) {
    return (
      <div
        className={styles.container}
        role="status"
        aria-live="polite"
      >
        <div className={styles.loading}>
          <div className={styles.spinner} aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (isError || !data) return null;

  const symbol = data.symbol || chain?.nativeCurrency.symbol || 'Native';
  const name = chain?.nativeCurrency.name || chain?.name || 'Native Token';

  const formattedBalance = (() => {
    const num = parseFloat(formatEther(data.value));
    if (num > 0 && num < 0.0001) return num.toFixed(8).replace(/\.?0+$/, '');
    if (num >= 0.0001) return num.toFixed(4).replace(/\.?0+$/, '');
    return '0';
  })();

  return (
    <div
      className={styles.container}
      role="region"
      aria-label={`${name} balance: ${formattedBalance} ${symbol}`}
    >
      <div className={styles.tokenInfo} aria-hidden="true">
        <div className={styles.tokenSymbol}>{symbol}</div>
        <div className={styles.tokenName}>{name}</div>
      </div>
      <div className={styles.balance}>
        <span
          className={styles.balanceValue}
          aria-live="polite"
        >
          {formattedBalance}
        </span>
        <span className={styles.balanceSymbol} aria-hidden="true">
          {symbol}
        </span>
      </div>
    </div>
  );
}
