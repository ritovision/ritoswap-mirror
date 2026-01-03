// app/gate/components/GatePageWrapper.tsx
"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './GatePageWrapper.module.css';
import GateModal from './GateModal/GateModal';
import Completion from './Completion/Completion';
import GatedContentRenderer from './GatedContentRenderer/GatedContentRenderer';
import InlineErrorBoundary from '@/components/errors/InlineErrorBoundary';
import { useAccount, useSignMessage } from 'wagmi';
import { useNFTStore } from '@/app/store/nftStore';
import { useNFTData } from '@/app/hooks/useNFTData';
import ProcessingModal from '@/components/wallet/processingModal/ProcessingModal';
import { isMobileDevice } from '@/app/utils/mobile';
import { openWalletDeeplink } from '@/app/utils/walletDeeplink';
import { showRateLimitModal } from '@/components/utilities/rateLimitModal/RateLimitModal';
import { sendNotificationEvent, sendErrorNotification } from '@/app/lib/notifications';
import { useDappChain } from '@/components/providers/DappChainProvider';
import { getTargetChainId } from '@config/chain';

// ✅ client library
import {
  formApi,
  tokenStatusApi,
  buildEnvelope as buildLocalEnvelope,
  buildBoundMessage as buildLocalBoundMessage,
  hasRateLimitInfo,
  isErrorResponse,
} from '@/app/lib/client';
import type { GatedContent } from '@/app/lib/client';

// Minimal window helpers/types to avoid `any`
type GatedEnvelope = { timestamp: number };
type GateHelpers = { buildBoundMessage: (tokenId: number, chainId: number, timestamp: number) => string };
type GateWindow = Window & { __gatedEnvelope?: GatedEnvelope; __gate?: GateHelpers };

function isNamedError(e: unknown): e is { name: string } {
  return typeof e === 'object' && e !== null && 'name' in e && typeof (e as { name: unknown }).name === 'string';
}

export default function GatePageWrapper() {
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { resetToActiveChain } = useDappChain();
  const targetChainId = getTargetChainId();

  const {
    setCurrentAddress,
    resetState,
    currentAddress,
    startAccountSwitch,
    completeAccountSwitch,
    isSwitchingAccount,
    tokenId,
    setHasUsedTokenGate
  } = useNFTStore();

  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());
  const isMountedRef = useRef(true);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { forceRefresh } = useNFTData(isAuthenticated);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fadeOutContent, setFadeOutContent] = useState(false);
  const [mountContent, setMountContent] = useState(false);
  const [mountCompletion, setMountCompletion] = useState(false);
  const [gatedContent, setGatedContent] = useState<GatedContent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      if (isMountedRef.current) {
        fn();
      }
    }, delay);
    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const timeouts = timeoutRefs.current;
    return () => {
      isMountedRef.current = false;
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    setIsUnlocked(false);
    setIsAnimating(false);
    setGatedContent(null);
  }, []);

  useEffect(() => {
    if (address !== currentAddress) {
      setGatedContent(null);
      setIsUnlocked(false);
      setIsAnimating(false);
      setMountContent(false);
      setMountCompletion(false);

      if (currentAddress && address) {
        startAccountSwitch();
        setCurrentAddress(address);
        addTimeout(async () => {
          await forceRefresh();
          addTimeout(() => {
            if (isSwitchingAccount) completeAccountSwitch();
          }, 1000);
        }, 300);
      } else if (address && !currentAddress) {
        setCurrentAddress(address);
        addTimeout(() => {
          forceRefresh();
        }, 300);
      } else if (!address && currentAddress) {
        resetState();
        setCurrentAddress(null);
        setIsUnlocked(false);
        setIsAnimating(false);
        setGatedContent(null);
      }
    }
  }, [
    address,
    currentAddress,
    setCurrentAddress,
    resetState,
    forceRefresh,
    startAccountSwitch,
    completeAccountSwitch,
    isSwitchingAccount,
    addTimeout,
  ]);

  useEffect(() => {
    if (!isConnected) {
      resetState();
      setIsUnlocked(false);
      setIsAnimating(false);
      setGatedContent(null);
    }
  }, [isConnected, resetState]);

  const handleUnlock = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsAnimating(true);
    addTimeout(() => {
      if (!isMountedRef.current) return;
      setMountContent(true);
      addTimeout(() => {
        if (!isMountedRef.current) return;
        setIsUnlocked(true);
      }, 50);
    }, 2000);
  }, [addTimeout]);

  const handleContentReceived = useCallback((content: GatedContent) => {
    if (!isMountedRef.current) return;
    setGatedContent(content);
    setIsAuthenticated(true);
  }, []);

  const handleSubmissionSuccess = useCallback(() => {
    if (!isMountedRef.current) return;
    setFadeOutContent(true);
    addTimeout(() => {
      if (!isMountedRef.current) return;
      setMountContent(false);
      setMountCompletion(true);
      addTimeout(() => {
        if (!isMountedRef.current) return;
        setShowCompletion(true);
      }, 50);
      addTimeout(() => {
        if (!isMountedRef.current) return;
        setShowCompletion(false);
        addTimeout(() => {
          if (!isMountedRef.current) return;
          setMountCompletion(false);
          setIsUnlocked(false);
          setIsAnimating(false);
          setFadeOutContent(false);
          setGatedContent(null);
          forceRefresh();
        }, 2000);
      }, 4000);
    }, 2000);
  }, [addTimeout, forceRefresh]);

	  const handleGatedSubmission = useCallback(async (text: string) => {
	    if (!address || tokenId == null) {
	      sendErrorNotification('Connection error. Please refresh and try again.');
	      return;
	    }

	    // Reset dapp chain to active chain before signing
	    resetToActiveChain();

	    setIsSubmitting(true);
	    const submitButton = document.getElementById('gatedSubmitButton') as HTMLButtonElement | null;

	    try {
	      const gw = window as unknown as GateWindow;
	      const env = gw.__gatedEnvelope ?? buildLocalEnvelope();

	      const messageToSign =
	        gw.__gate?.buildBoundMessage
	          ? gw.__gate.buildBoundMessage(tokenId, targetChainId, env.timestamp)
	          : buildLocalBoundMessage({ tokenId, chainId: targetChainId, envelope: env });

      const sigPromise = signMessageAsync({ message: messageToSign });

      if (isMobileDevice() && connector?.id === 'walletConnect') {
        openWalletDeeplink();
      }

      const signature = await sigPromise;
      if (!isMountedRef.current) return;

      const result = await formApi.submitForm({
        tokenId: String(tokenId),
        message: text,
        signature,
        address,
        timestamp: env.timestamp,
      });

      if (result.ok) {
        sendNotificationEvent('MESSAGE_RECORDED', { source: 'user' });
        setHasUsedTokenGate(true);

        try {
          await tokenStatusApi.fetchTokenStatus(tokenId);
        } catch {
        }

        handleSubmissionSuccess();
      } else {
        if (result.status === 429) {
          const rl = result.rateLimit || (hasRateLimitInfo(result.error) ? result.error : undefined);
          if (rl) {
            showRateLimitModal({
              limit: rl.limit,
              remaining: rl.remaining,
              retryAfter: rl.retryAfter
            });
          }
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign & Submit';
            submitButton.classList.remove('processing');
          }
          setIsSubmitting(false);
          return;
        }

        const errText =
          isErrorResponse(result.error) ? result.error.error : 'Failed to submit';

        if (errText === 'Signature expired') {
          sendErrorNotification('Signature expired. Please try again.');
        } else if (errText === 'Invalid signature') {
          sendErrorNotification('Invalid signature. Please try again.');
        } else if (errText === 'You do not own this token') {
          sendNotificationEvent('NOT_TOKEN_OWNER');
        } else if (errText === 'This token has already been used') {
          sendErrorNotification('This token has already been used.');
          setHasUsedTokenGate(true);
        } else {
          sendErrorNotification(errText);
        }

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Sign & Submit';
          submitButton.classList.remove('processing');
        }
      }
    } catch (err: unknown) {
      if (isNamedError(err) && err.name === 'UserRejectedRequestError') {
        sendNotificationEvent('TRANSACTION_CANCELLED');
      } else {
        sendErrorNotification('Failed to submit. Please try again.');
      }
      console.error('Submission error:', err);

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Sign & Submit';
        submitButton.classList.remove('processing');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
	  }, [
	    address,
	    tokenId,
	    signMessageAsync,
	    connector,
	    setHasUsedTokenGate,
	    handleSubmissionSuccess,
	    targetChainId,
	    resetToActiveChain,
	  ]);

  return (
    <div className={styles.container}>
      <div
        className={`${styles.modalOverlay} ${isAnimating ? styles.fadeOut : ''} ${
          showCompletion ? styles.hidden : ''
        }`}
      >
        <InlineErrorBoundary
          component="gate-modal"
          title="Gate unavailable"
          message="Please refresh and try again."
        >
          <GateModal
            onUnlock={handleUnlock}
            isAnimating={isAnimating}
            onContentReceived={handleContentReceived}
          />
        </InlineErrorBoundary>
      </div>

      {mountContent && gatedContent && (
        <div
          className={`${styles.contentWrapper} ${
            isUnlocked && !fadeOutContent ? styles.fadeIn : ''
          } ${fadeOutContent ? styles.fadeOut : ''}`}
        >
          <GatedContentRenderer
            content={gatedContent}
            onSubmit={handleGatedSubmission}
          />
        </div>
      )}

      {mountCompletion && (
        <div className={`${styles.completionArea} ${showCompletion ? styles.fadeIn : ''}`}>
          <Completion />
        </div>
      )}

      <div className={styles.modalWrapper}>
        <ProcessingModal isVisible={isSubmitting} onCancel={() => setIsSubmitting(false)} />
      </div>
    </div>
  );
}
