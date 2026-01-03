// app/portfolio/components/selection/AccountDropdown.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEnsName } from 'wagmi';
import dropdownStyles from '@components/utilities/dropdown/Dropdown.module.css';

interface AccountDropdownProps {
  isConnected: boolean;
  selectedAddress: string;
  addresses: readonly `0x${string}`[];
  onConnect: () => void;
  onAddressChange: (address: string) => void;
}

const shorten = (addr: string) =>
  `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

/**
 * Single address item in the listbox.
 * Handles click + keyboard activation (Enter/Space).
 */
function AddressItem({
  addr,
  onClick,
  isSelected,
}: {
  addr: `0x${string}`;
  onClick: () => void;
  isSelected: boolean;
}) {
  const { data: ensName } = useEnsName({
    address: addr,
    chainId: 1, // mainnet ENS
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <li
      id={`account-dropdown-item-${addr}`}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={dropdownStyles.dropdownItem}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {ensName ?? shorten(addr)}
    </li>
  );
}

/**
 * AccountDropdown renders a button that toggles a listbox of Ethereum addresses.
 *
 * - Button supports Enter/Space to open/connect.
 * - List supports selection via click or keyboard.
 * - Full ARIA roles/attributes for screen readers.
 */
export default function AccountDropdown({
  isConnected,
  selectedAddress,
  addresses,
  onConnect,
  onAddressChange,
}: AccountDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // IDs for ARIA
  const labelId = 'account-dropdown-label';
  const buttonId = 'account-dropdown-button';
  const listId = 'account-dropdown-list';

  // resolve ENS for selected address
  const { data: selectedENS } = useEnsName({
    address: selectedAddress as `0x${string}`,
    chainId: 1,
  });

  // close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!mounted || !isConnected) {
        onConnect();
      } else {
        setOpen((o) => !o);
      }
    }
  };

  const handleButtonClick = () => {
    if (!mounted || !isConnected) {
      onConnect();
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <div ref={containerRef} className={dropdownStyles.dropdownContainer}>
      <div
        id={labelId}
        style={{
          textAlign: 'center',
          marginBottom: '8px',
          color: 'inherit',
          fontFamily: 'var(--font-primary)',
          fontSize: '20px',
        }}
      >
        Select Address
      </div>

      <div
        id={buttonId}
        role="button"
        tabIndex={0}
        className={`
          ${dropdownStyles.dropdownButton}
          ${!isConnected ? dropdownStyles.disabled : ''}
          ${open ? dropdownStyles.open : ''}
        `}
        onClick={handleButtonClick}
        onKeyDown={handleButtonKeyDown}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        aria-disabled={!isConnected}
      >
        <span className={dropdownStyles.displayText}>
          {!mounted || !isConnected
            ? 'Connect Wallet'
            : selectedENS ?? shorten(selectedAddress)}
        </span>
        <svg
          width="12"
          height="12"
          className={`
            ${dropdownStyles.triangleIcon}
            ${open ? dropdownStyles.triangleUp : dropdownStyles.triangleDown}
          `}
          viewBox="0 0 10 6"
          fill="none"
        >
          <path d="M1 1 L5 5 L9 1" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {mounted && open && isConnected && (
        <div className={dropdownStyles.dropdownListWrapper}>
          <div className={dropdownStyles.middleSection}>
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className={dropdownStyles.dropdownList}
            >
              {addresses.map((addr) => (
                <AddressItem
                  key={addr}
                  addr={addr}
                  onClick={() => {
                    onAddressChange(addr);
                    setOpen(false);
                  }}
                  isSelected={addr === selectedAddress}
                />
              ))}
            </ul>
          </div>
          <div className={dropdownStyles.bottomSection} />
        </div>
      )}
    </div>
  );
}
