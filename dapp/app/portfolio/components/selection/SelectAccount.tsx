// app/portfolio/components/selection/SelectAccount.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import AccountDropdown from './AccountDropdown';
import ConnectModal from '@/components/wallet/connectModal/ConnectModal';

interface SelectAccountProps {
  /** Called whenever the selected address changes (including disconnect) */
  onAccountChange?: (address: string) => void;
}

/**
 * Renders an account selector that shows all connected addresses and,
 * if none are connected, opens a custom wallet connect modal.
 */
const SelectAccount: React.FC<SelectAccountProps> = ({ onAccountChange }) => {
  const { address, addresses, isConnected } = useAccount();
  const [selected, setSelected] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Sync internal selected state & notify parent when connection changes
  useEffect(() => {
    setTimeout(() => {
      if (isConnected && address) {
        setSelected(address);
        onAccountChange?.(address);
      } else {
        setSelected('');
        onAccountChange?.('');
      }
    }, 0);
  }, [isConnected, address, onAccountChange]);

  /** User picked a different address from the dropdown */
  const handleAddressChange = (addr: string) => {
    setSelected(addr);
    onAccountChange?.(addr);
  };

  /** Trigger opening of our custom ConnectModal */
  const handleConnectClick = () => {
    setIsModalOpen(true);
  };

  // All connected addresses or empty array if not connected
  const items = isConnected && addresses ? addresses : [];

  return (
    <>
      <AccountDropdown
        isConnected={isConnected}
        selectedAddress={selected}
        addresses={items}
        onConnect={handleConnectClick}
        onAddressChange={handleAddressChange}
      />

      <ConnectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default SelectAccount;
