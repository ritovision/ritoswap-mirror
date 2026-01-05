'use client';

import React from 'react';
import { useAccount } from 'wagmi';

export default function WalletReady({
  requiredConnected = false,
  children,
}: {
  requiredConnected?: boolean;
  children: React.ReactNode;
}) {
  const { isConnected } = useAccount();

  if (requiredConnected && !isConnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        Connecting wallet...
      </div>
    );
  }

  return <>{children}</>;
}

