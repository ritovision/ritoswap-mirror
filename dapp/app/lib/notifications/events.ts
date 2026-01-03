// app/lib/notifications/events.ts
'use client';

import type { NotificationOptions } from './index';

export type NotificationEvent = Omit<NotificationOptions, 'source'> & {
  source?: NotificationOptions['source'];
};

/**
 * Predefined notification events that can be reused across the application
 */
export const NOTIFICATION_EVENTS = {
  // NFT Events
  NFT_MINTED: {
    title: 'NFT Minted!',
    body: 'Your NFT has been successfully minted',
    type: 'success',
    tag: 'nft-minted',
    source: 'user',
    channels: 'both',
  } as NotificationEvent,

  NFT_BURNED: {
    title: 'NFT Burned!',
    body: 'Your NFT has been successfully burned',
    type: 'success',
    tag: 'nft-burned',
    source: 'user',
    channels: 'both',
  } as NotificationEvent,

  NFT_RECEIVED: {
    title: 'NFT Received!',
    body: 'You have received a new NFT',
    type: 'success',
    tag: 'nft-received',
    source: 'watcher',
    channels: 'both',
  } as NotificationEvent,

  NFT_TRANSFERRED: {
    title: 'NFT Transferred!',
    body: 'Your NFT has been successfully transferred',
    type: 'success',
    tag: 'nft-transferred',
    source: 'watcher',
    channels: 'both',
  } as NotificationEvent,

  // Transaction Events
  TRANSACTION_PENDING: {
    title: 'Transaction Pending',
    body: 'Your transaction is being processed',
    type: 'loading',
    source: 'user',
    channels: 'toast',
  } as NotificationEvent,

  TRANSACTION_CONFIRMED: {
    title: 'Transaction Confirmed',
    body: 'Your transaction has been confirmed',
    type: 'success',
    source: 'watcher',
    channels: 'both',
  } as NotificationEvent,

  TRANSACTION_FAILED: {
    title: 'Transaction Failed',
    body: 'Your transaction could not be completed',
    type: 'error',
    source: 'user',
    channels: 'both',
  } as NotificationEvent,

  TRANSACTION_CANCELLED: {
    title: 'Transaction Cancelled',
    body: 'Transaction was cancelled by user',
    type: 'info',
    source: 'user',
    channels: 'toast',
  } as NotificationEvent,

  // Gate Events
  GATE_UNLOCKED: {
    title: 'Token Gate Unlocked!',
    body: 'Access granted to the token gate',
    type: 'success',
    tag: 'gate-unlocked',
    source: 'system',
    channels: 'both',
  } as NotificationEvent,

  MESSAGE_RECORDED: {
    title: 'Message Recorded!',
    body: 'Your message has been recorded and your key has been used',
    type: 'success',
    tag: 'message-recorded',
    source: 'user',
    channels: 'both',
  } as NotificationEvent,

  // Wallet Events
  WALLET_CONNECTED: {
    title: 'Wallet Connected',
    body: 'Your wallet has been successfully connected',
    type: 'success',
    source: 'user',
    channels: 'toast',
  } as NotificationEvent,

  WALLET_DISCONNECTED: {
    title: 'Wallet Disconnected',
    body: 'Your wallet has been disconnected',
    type: 'info',
    source: 'user',
    channels: 'toast',
  } as NotificationEvent,

  // Error Events
  INSUFFICIENT_FUNDS: {
    title: 'Insufficient Funds',
    body: 'You do not have enough funds for this transaction',
    type: 'error',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,

  INVALID_TOKEN_ID: {
    title: 'Invalid Token ID',
    body: 'The provided token ID is invalid',
    type: 'error',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,

  NOT_TOKEN_OWNER: {
    title: 'Not Token Owner',
    body: 'You are not the owner of this NFT',
    type: 'error',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,

  ALREADY_MINTED: {
    title: 'Already Minted',
    body: 'You already own an NFT',
    type: 'error',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,

  // System Events
  DATA_REFRESHED: {
    title: 'Data Refreshed',
    body: 'Your data has been updated',
    type: 'info',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,

  NETWORK_ERROR: {
    title: 'Network Error',
    body: 'Unable to connect to the network',
    type: 'error',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,

  CONTRACT_ERROR: {
    title: 'Contract Error',
    body: 'An error occurred while interacting with the contract',
    type: 'error',
    source: 'system',
    channels: 'toast',
  } as NotificationEvent,
} as const;

// Helper function to get event by tag
export function getEventByTag(tag: string): NotificationEvent | undefined {
  return Object.values(NOTIFICATION_EVENTS).find(event => event.tag === tag);
}

// Helper function to check if an event exists
export function hasEvent(eventName: keyof typeof NOTIFICATION_EVENTS): boolean {
  return eventName in NOTIFICATION_EVENTS;
}