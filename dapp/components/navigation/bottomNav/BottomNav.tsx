import React from "react";
import styles from "./BottomNav.module.css";
import ConnectWrapper from "@/components/wallet/connectButton/ConnectWrapper";
import NetworkWidget from '@/components/wallet/network/NetworkWidget';
import AddressDisplay from "@/components/wallet/addressDisplay/AddressDisplay";
import DisconnectButton from "@/components/wallet/disconnectButton/DisconnectButton";

export default function BottomNav() {
  return (
    <div className={`bottomnav ${styles.container}`} data-testid="wallet-bar">
      <div className={styles.walletContainer}>
        <ConnectWrapper variant="bottomnav" />
        <NetworkWidget variant="bottomnav" />
        <AddressDisplay variant="bottomnav" />
        <DisconnectButton variant="bottomnav" />
      </div>
    </div>
  );
}