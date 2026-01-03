'use client';

import React from 'react';
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
const log = createLogger('[WagmiBoundary]');

type Props = { fallback: React.ReactNode; children: React.ReactNode };
type State = { hasError: boolean };

export default class WagmiBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'test') {
      log.error('Caught error, rendering fallback', { error, componentStack: info?.componentStack });
    }
    // intentionally swallow to allow fallback UI in tests
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
