import React from 'react';
import type { Connector } from 'wagmi';

import { MOCK_WALLETCONNECT_URI } from '../mocks/mockWagmiConfig';

import modalStyles from '@/components/wallet/connectModal/styles/ModalWrapper.module.css';
import { ModalWrapper } from '@/components/wallet/connectModal/components/ModalWrapper';
import { DefaultView } from '@/components/wallet/connectModal/views/DefaultView';
import { QrView } from '@/components/wallet/connectModal/views/QrView';
import { ConnectingView } from '@/components/wallet/connectModal/views/ConnectingView';
import { ErrorView } from '@/components/wallet/connectModal/views/ErrorView';
import { CanceledView } from '@/components/wallet/connectModal/views/CanceledView';
import { GetWalletView } from '@/components/wallet/connectModal/views/GetWalletView';
import type { ModalState } from '@/components/wallet/connectModal/hooks/useWalletConnection';

export type ConnectModalStoryWallet = 'metamask' | 'trust' | 'walletconnect' | 'none';
export type ConnectModalStoryOutcome = 'success' | 'error' | 'canceled';

export type ConnectModalViewsHarnessProps = {
  state?: ModalState;
  qrUri?: string;
  copied?: boolean;
  connectingWallet?: ConnectModalStoryWallet;
  canOpenMobile?: boolean;
};

export const CONNECT_MODAL_STORY_CONNECTORS: Connector[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    type: 'injected',
    icon: '/images/wallets/metamask-logo.png',
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    type: 'injected',
    icon: '/images/wallets/trust-wallet-logo.png',
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    type: 'walletConnect',
  },
] as unknown as Connector[];

function resolveWalletInfo(
  wallet: ConnectModalStoryWallet,
): { name: string; icon?: string; isWalletConnect?: boolean } | null {
  switch (wallet) {
    case 'metamask':
      return { name: 'MetaMask', icon: '/images/wallets/metamask-logo.png' };
    case 'trust':
      return { name: 'Trust Wallet', icon: '/images/wallets/trust-wallet-logo.png' };
    case 'walletconnect':
      return { name: 'WalletConnect', icon: '/images/wallets/walletconnect.png', isWalletConnect: true };
    default:
      return null;
  }
}

export function ConnectModalViewsHarness({
  state = 'default',
  qrUri = MOCK_WALLETCONNECT_URI,
  copied = false,
  connectingWallet = 'metamask',
  canOpenMobile = false,
}: ConnectModalViewsHarnessProps) {
  const modalClass =
    state === 'connecting' || state === 'error' || state === 'canceled' ? modalStyles.modalLoading : modalStyles.modal;

  const content = (() => {
    switch (state) {
      case 'get-wallet':
        return <GetWalletView onBack={() => {}} />;
      case 'walletconnect-qr':
        return <QrView qrUri={qrUri} copied={copied} onBack={() => {}} onCopy={() => {}} />;
      case 'connecting':
        return (
          <ConnectingView
            wallet={resolveWalletInfo(connectingWallet)}
            onCancel={() => {}}
            onOpenWallet={() => console.info('Open wallet deeplink:', qrUri)}
            canOpenMobile={canOpenMobile}
          />
        );
      case 'error':
        return <ErrorView wallet={resolveWalletInfo(connectingWallet)} />;
      case 'canceled':
        return <CanceledView wallet={resolveWalletInfo(connectingWallet)} />;
      default:
        return (
          <DefaultView
            connectors={CONNECT_MODAL_STORY_CONNECTORS}
            onSelect={() => {}}
            onGetWallet={() => {}}
            onClose={() => {}}
          />
        );
    }
  })();

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className={modalStyles.backdrop} onClick={() => {}} aria-label="Close modal" />
      <ModalWrapper modalClass={modalClass} labelledBy={state === 'default' ? 'modal-title' : undefined}>
        {content}
      </ModalWrapper>
    </div>
  );
}

export function ConnectModalFlowHarness() {
  const [isOpen, setIsOpen] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(false);
  const [nextOutcome, setNextOutcome] = React.useState<ConnectModalStoryOutcome>('success');

  const [state, setState] = React.useState<ModalState>('default');
  const [qrUri, setQrUri] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [connectingWallet, setConnectingWallet] = React.useState<ConnectModalStoryWallet>('none');

  const timersRef = React.useRef<number[]>([]);

  const clearTimers = React.useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  React.useEffect(() => clearTimers, [clearTimers]);

  const reset = React.useCallback(() => {
    clearTimers();
    setIsOpen(true);
    setState('default');
    setQrUri('');
    setCopied(false);
    setConnectingWallet('none');
  }, [clearTimers]);

  const close = React.useCallback(() => {
    clearTimers();
    setIsOpen(false);
    setState('default');
    setQrUri('');
    setCopied(false);
    setConnectingWallet('none');
  }, [clearTimers]);

  const open = React.useCallback(() => {
    clearTimers();
    setIsOpen(true);
    setState('default');
    setQrUri('');
    setCopied(false);
    setConnectingWallet('none');
  }, [clearTimers]);

  const transitionBackToDefaultAfter = React.useCallback(
    (ms: number) => {
      const id = window.setTimeout(() => {
        setState('default');
        setQrUri('');
        setCopied(false);
        setConnectingWallet('none');
      }, ms);
      timersRef.current.push(id);
    },
    [],
  );

  const simulateFinish = React.useCallback(() => {
    clearTimers();
    if (nextOutcome === 'success') {
      close();
      return;
    }

    setState(nextOutcome === 'canceled' ? 'canceled' : 'error');
    transitionBackToDefaultAfter(1500);
  }, [clearTimers, close, nextOutcome, transitionBackToDefaultAfter]);

  const simulateScan = React.useCallback(() => {
    clearTimers();
    setState('connecting');
    const id = window.setTimeout(() => simulateFinish(), 600);
    timersRef.current.push(id);
  }, [clearTimers, simulateFinish]);

  const handleSelect = React.useCallback(
    (connector: Connector) => {
      clearTimers();
      if (connector.type === 'walletConnect') {
        setConnectingWallet('walletconnect');
        setQrUri(MOCK_WALLETCONNECT_URI);
        setState('walletconnect-qr');
        return;
      }

      if (connector.id === 'trust') setConnectingWallet('trust');
      else setConnectingWallet('metamask');
      setState('connecting');
    },
    [clearTimers],
  );

  const canOpenMobile = isMobile && connectingWallet === 'walletconnect';

  const modalClass =
    state === 'connecting' || state === 'error' || state === 'canceled' ? modalStyles.modalLoading : modalStyles.modal;

  const content = (() => {
    switch (state) {
      case 'get-wallet':
        return <GetWalletView onBack={() => setState('default')} />;
      case 'walletconnect-qr':
        return (
          <QrView
            qrUri={qrUri || MOCK_WALLETCONNECT_URI}
            copied={copied}
            onBack={() => setState('default')}
            onCopy={() => setCopied(true)}
          />
        );
      case 'connecting':
        return (
          <ConnectingView
            wallet={resolveWalletInfo(connectingWallet)}
            onCancel={() => setState('default')}
            onOpenWallet={() => console.info('Open wallet deeplink:', qrUri || MOCK_WALLETCONNECT_URI)}
            canOpenMobile={canOpenMobile}
          />
        );
      case 'error':
        return <ErrorView wallet={resolveWalletInfo(connectingWallet)} />;
      case 'canceled':
        return <CanceledView wallet={resolveWalletInfo(connectingWallet)} />;
      default:
        return (
          <DefaultView
            connectors={CONNECT_MODAL_STORY_CONNECTORS}
            onSelect={handleSelect}
            onGetWallet={() => setState('get-wallet')}
            onClose={close}
          />
        );
    }
  })();

  return (
    <div style={{ minHeight: '100vh' }}>
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 10,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          color: 'white',
        }}
      >
        <button type="button" onClick={reset}>
          Reset
        </button>
        <button type="button" onClick={isOpen ? close : open}>
          {isOpen ? 'Close' : 'Open'}
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={isMobile} onChange={(e) => setIsMobile(e.currentTarget.checked)} />
          Mobile
        </label>
        <select value={nextOutcome} onChange={(e) => setNextOutcome(e.currentTarget.value as ConnectModalStoryOutcome)}>
          <option value="success">Next: Success</option>
          <option value="error">Next: Error</option>
          <option value="canceled">Next: Canceled</option>
        </select>
        {isOpen && state === 'walletconnect-qr' && (
          <button type="button" onClick={simulateScan}>
            Simulate scan
          </button>
        )}
        {isOpen && state === 'connecting' && (
          <button type="button" onClick={simulateFinish}>
            Finish connection
          </button>
        )}
      </div>

      {!isOpen ? (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <button type="button" onClick={open}>
            Open modal
          </button>
        </div>
      ) : (
        <>
          <div className={modalStyles.backdrop} onClick={close} aria-label="Close modal" />
          <ModalWrapper modalClass={modalClass} labelledBy={state === 'default' ? 'modal-title' : undefined}>
            {content}
          </ModalWrapper>
        </>
      )}
    </div>
  );
}

