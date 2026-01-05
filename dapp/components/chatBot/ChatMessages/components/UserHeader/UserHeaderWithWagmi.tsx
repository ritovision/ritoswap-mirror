'use client';

import React, { useEffect, useState } from 'react';
import styles from '../../ChatMessages.module.css';
import { useAccount, useEnsName, useEnsAvatar } from 'wagmi';
import { publicConfig } from '@config/public.env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const ENV_LEVEL = publicConfig.logLevel as Level;

function createLogger(scope: string) {
  const should = (level: Level) => LEVELS[level] >= LEVELS[ENV_LEVEL];
  const fmt = (level: Level, ...args: unknown[]) => [`${new Date().toISOString()} ${scope} ${level.toUpperCase()}:`, ...args];
  return {
    debug: (...a: unknown[]) => should('debug') && console.debug(...fmt('debug', ...a)),
    info:  (...a: unknown[]) => should('info')  && console.info (...fmt('info',  ...a)),
    warn:  (...a: unknown[]) => should('warn')  && console.warn (...fmt('warn',  ...a)),
    error: (...a: unknown[]) => should('error') && console.error(...fmt('error', ...a)),
  };
}
const log = createLogger('[UserHeader]');

export default function UserHeaderWithWagmi() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, status: accountStatus } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: ensName,
    error: ensNameError,
  } = useEnsName({
    address,
    chainId: 1,
    query: { enabled: Boolean(address) && mounted },
  });

  const {
    data: ensAvatar,
    error: ensAvatarError,
  } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
    query: { enabled: Boolean(ensName) && mounted },
  });

  useEffect(() => {
    log.debug('Account state', { isConnected, accountStatus, address });
  }, [isConnected, accountStatus, address]);

  useEffect(() => {
    if (ensName) log.debug('ENS name resolved', { ensName, address });
    if (ensNameError) log.warn('ENS name resolution error', ensNameError);
  }, [ensName, ensNameError, address]);

  useEffect(() => {
    if (ensAvatar) log.debug('ENS avatar resolved', { hasAvatar: true });
    if (ensAvatarError) log.warn('ENS avatar resolution error', ensAvatarError);
  }, [ensAvatar, ensAvatarError]);

  // Format name as "{ENS} (You)" when ENS exists, otherwise just "You"
  const name = isConnected && ensName ? `${ensName} (You)` : 'You';

  return (
    <div className={styles.messageHeader}>
      <div className={styles.messageRole}>
        {isConnected && ensAvatar ? (
          <img src={ensAvatar} alt={name} className={styles.ensAvatar} />
        ) : (
          <div className={styles.placeholderAvatar}>U</div>
        )}
        <span>{name}</span>
      </div>
    </div>
  );
}
