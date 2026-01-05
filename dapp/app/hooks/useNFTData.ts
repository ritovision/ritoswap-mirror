// app/hooks/useNFTData.ts
import { useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNFTStore } from '@/app/store/nftStore';
import { fullKeyTokenAbi, KEY_TOKEN_ADDRESS } from '@config/contracts';
import { getTargetChainId } from '@config/chain';
import type { TokenStatusResponse } from '@/app/schemas/dto/token-status.dto';

// Query key factory - includes address for proper cache separation
const tokenStatusQueryKey = (tokenId: number | null, address?: string) => 
  ['token-status', tokenId, address] as const;

/**
 * Fetch token status with proper typing
 */
async function fetchTokenStatus(tokenId: number): Promise<TokenStatusResponse> {
  console.log(`[TanStack Query] Fetching token ${tokenId} at ${new Date().toISOString()}`);
  const res = await fetch(`/api/token-status/${tokenId}`);
  
  if (!res.ok) {
    // Try to parse error response for better error messages
    try {
      const errorData = await res.json();
      throw new Error(errorData.detail || errorData.title || errorData.error || 'Failed to fetch token status');
    } catch {
      throw new Error('Failed to fetch token status');
    }
  }
  
  return res.json() as Promise<TokenStatusResponse>;
}

export type UseNFTDataOptions = {
  enabled?: boolean;
  disablePolling?: boolean;
};

function normalizeOptions(options?: boolean | UseNFTDataOptions) {
  if (typeof options === 'boolean') {
    return { enabled: true, disablePolling: options };
  }
  return {
    enabled: options?.enabled ?? true,
    disablePolling: options?.disablePolling ?? false,
  };
}

export function useNFTData(options?: boolean | UseNFTDataOptions) {
  const { enabled, disablePolling } = normalizeOptions(options);
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const {
    setHasNFT,
    setTokenData,
    setLoading,
    setHasUsedTokenGate,
    hasNFT,
    tokenId,
    isSwitchingAccount,
    completeAccountSwitch,
    startAccountSwitch
  } = useNFTStore();

  const chainId = getTargetChainId();
  const prevAddressRef = useRef<string | undefined>(undefined);
  const hasInitializedRef = useRef(false);
  const accountSwitchTokenIdRef = useRef<number | null>(null);

  // Simple account switch detection
  useEffect(() => {
    if (!enabled) return;
    // Skip if not connected
    if (!isConnected || !address) {
      // Reset on disconnect
      if (prevAddressRef.current) {
        console.log('[useNFTData] Disconnected, clearing data');
        setTokenData(null, null, null);
        setHasNFT(false);
        setHasUsedTokenGate(false);
        prevAddressRef.current = undefined;
        hasInitializedRef.current = false;
        accountSwitchTokenIdRef.current = null;
        
        // Clear all token status cache on disconnect
        queryClient.removeQueries({ queryKey: ['token-status'] });
      }
      return;
    }

    // Detect account change (not initial load)
    if (prevAddressRef.current && prevAddressRef.current !== address) {
      console.log('[useNFTData] Account switch detected:', prevAddressRef.current, '->', address);
      startAccountSwitch();
      
      // IMPORTANT: Remove all token status cache entries to prevent stale data
      queryClient.removeQueries({ queryKey: ['token-status'] });
      
      // Clear data for new account immediately
      setTokenData(null, null, null);
      setHasNFT(false);
      setHasUsedTokenGate(false);
      accountSwitchTokenIdRef.current = null;
    }

    prevAddressRef.current = address;
    hasInitializedRef.current = true;
  }, [address, isConnected, startAccountSwitch, setTokenData, setHasNFT, setHasUsedTokenGate, queryClient, enabled]);

  // On-chain token ownership query
  const {
    data: tokenData,
    refetch: refetchToken,
    isLoading: loadingToken,
    isRefetching: refetchingToken
  } = useReadContract({
    address: KEY_TOKEN_ADDRESS,
    abi: fullKeyTokenAbi,
    functionName: 'getTokenOfOwner',
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: enabled && !!address && isConnected,
      refetchInterval: disablePolling
        ? false
        : isSwitchingAccount
        ? 1000
        : 2000
    }
  });

  // On-chain token color query
  const {
    data: tokenColors,
    refetch: refetchColors,
    isLoading: loadingColors
  } = useReadContract({
    address: KEY_TOKEN_ADDRESS,
    abi: fullKeyTokenAbi,
    functionName: 'getTokenColors',
    args: tokenData && tokenData[1] ? [tokenData[0]] : undefined,
    chainId,
    query: {
      enabled: enabled && !!tokenData && tokenData[1] && isConnected,
      refetchInterval: disablePolling
        ? false
        : isSwitchingAccount
        ? 1000
        : 2000
    }
  });

  // Extract tokenId from tokenData for the query
  const currentTokenId = tokenData && tokenData[1] ? Number(tokenData[0]) : null;

  // Use TanStack Query for token usage check with typed response
  const {
    data: tokenUsageData,
    error: tokenUsageError,
    isLoading: isLoadingUsage
  } = useQuery<TokenStatusResponse, Error>({
    queryKey: tokenStatusQueryKey(currentTokenId, address),
    queryFn: () => {
      if (!currentTokenId) {
        throw new Error('No token ID available');
      }
      return fetchTokenStatus(currentTokenId);
    },
    enabled: enabled && !!currentTokenId && isConnected && !!address,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache at all
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // CRITICAL: Force fetch token usage when we detect a new token during account switch
  useEffect(() => {
    if (!enabled) return;
    if (isSwitchingAccount && currentTokenId && currentTokenId !== accountSwitchTokenIdRef.current) {
      console.log('[useNFTData] New token detected during switch, forcing usage fetch for token:', currentTokenId);
      accountSwitchTokenIdRef.current = currentTokenId;
      
      // Directly fetch the token usage status
      fetchTokenStatus(currentTokenId)
        .then((data) => {
          console.log('[useNFTData] Token usage fetched during switch:', data);
          if (data && data.exists) {
            setHasUsedTokenGate(data.used);
          } else {
            setHasUsedTokenGate(false);
          }
        })
        .catch((error) => {
          console.error('[useNFTData] Error fetching token usage during switch:', error);
          setHasUsedTokenGate(false);
        });
    }
  }, [isSwitchingAccount, currentTokenId, setHasUsedTokenGate, enabled]);

  // Update store when token usage data changes (for non-switching scenarios)
  useEffect(() => {
    if (!enabled) return;
    if (!isSwitchingAccount && tokenUsageData && tokenUsageData.exists) {
      console.log('[useNFTData] Setting hasUsedTokenGate:', tokenUsageData.used);
      setHasUsedTokenGate(tokenUsageData.used);
    } else if (!isSwitchingAccount && tokenUsageData && !tokenUsageData.exists) {
      setHasUsedTokenGate(false);
    }
  }, [tokenUsageData, setHasUsedTokenGate, isSwitchingAccount, enabled]);

  // Log token usage errors
  useEffect(() => {
    if (!enabled) return;
    if (tokenUsageError) {
      console.error('Error fetching token usage:', tokenUsageError);
    }
  }, [tokenUsageError, enabled]);

  // Manual trigger to refetch everything
  const forceRefresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      // Clear cache before refreshing
      queryClient.removeQueries({ queryKey: ['token-status'] });
      
      // wait a bit if switching
      await new Promise((r) => setTimeout(r, isSwitchingAccount ? 500 : 1000));
      const tok = await refetchToken();
      if (tok.data) {
        const [tid, owned] = tok.data;
        if (owned) {
          setHasNFT(true);
          
          // Directly fetch token usage
          try {
            const usageData = await fetchTokenStatus(Number(tid));
            if (usageData && usageData.exists) {
              setHasUsedTokenGate(usageData.used);
            } else {
              setHasUsedTokenGate(false);
            }
          } catch (error) {
            console.error('Error fetching token usage in forceRefresh:', error);
            setHasUsedTokenGate(false);
          }
          
          const colors = await refetchColors();
          if (colors.data) {
            setTokenData(Number(tid), colors.data[0], colors.data[1]);
          }
        } else {
          setTokenData(null, null, null);
          setHasNFT(false);
          setHasUsedTokenGate(false);
        }
      }
      if (isSwitchingAccount) {
        completeAccountSwitch();
      }
    } catch (e) {
      console.error('Error in forceRefresh', e);
    } finally {
      setLoading(false);
    }
  }, [
    refetchToken,
    refetchColors,
    isSwitchingAccount,
    completeAccountSwitch,
    setTokenData,
    setHasNFT,
    setHasUsedTokenGate,
    setLoading,
    queryClient,
    enabled
  ]);

  // Sync tokenData changes
  useEffect(() => {
    if (!enabled) return;
    if (!isConnected || isSwitchingAccount) {
      return;
    }

    if (tokenData !== undefined) {
      const [tid, owned] = tokenData;
      const changed = owned !== hasNFT || (owned && Number(tid) !== tokenId);
      
      if (changed) {
        console.log('[useNFTData] Token ownership changed:', { owned, tokenId: tid });
        setHasNFT(owned);
        if (owned) {
          // For non-switching scenarios, also fetch usage directly
          fetchTokenStatus(Number(tid))
            .then((data) => {
              if (data && data.exists) {
                console.log('[useNFTData] Token usage fetched:', data.used);
                setHasUsedTokenGate(data.used);
              }
            })
            .catch((error) => {
              console.error('[useNFTData] Error fetching token usage:', error);
            });
            
          if (tokenColors) {
            console.log('[useNFTData] Updating token data:', tid, tokenColors);
            setTokenData(Number(tid), tokenColors[0], tokenColors[1]);
          }
        } else {
          setTokenData(null, null, null);
          setHasUsedTokenGate(false);
        }
      }
    }
  }, [
    tokenData,
    tokenColors,
    hasNFT,
    tokenId,
    isSwitchingAccount,
    isConnected,
    setTokenData,
    setHasNFT,
    setHasUsedTokenGate,
    enabled
  ]);

  // Complete account switch when new data arrives
  useEffect(() => {
    if (!enabled) return;
    if (isSwitchingAccount && tokenData !== undefined) {
      const [tid, owned] = tokenData;
      
      // Wait a bit to ensure usage data has been fetched
      const checkComplete = () => {
        if (!owned) {
          // No token, can complete immediately
          console.log('[useNFTData] No token for new account, completing switch');
          completeAccountSwitch();
        } else if (tokenColors) {
          // Has token and colors, complete after ensuring data is set
          console.log('[useNFTData] New account data ready, completing switch');
          setTokenData(Number(tid), tokenColors[0], tokenColors[1]);
          
          setTimeout(() => {
            completeAccountSwitch();
          }, 200);
        }
      };
      
      // Give token usage fetch time to complete
      setTimeout(checkComplete, 300);
    }
  }, [isSwitchingAccount, tokenData, tokenColors, setTokenData, completeAccountSwitch, enabled]);

  // Turn off loading when both contracts idle
  useEffect(() => {
    if (!enabled) return;
    if (!loadingToken && !refetchingToken && !loadingColors && !isLoadingUsage) {
      setLoading(false);
    }
  }, [loadingToken, refetchingToken, loadingColors, isLoadingUsage, setLoading, enabled]);

  return {
    forceRefresh,
    isLoading: enabled && (loadingToken || loadingColors || isLoadingUsage),
    refetchToken,
    refetchColors,
    tokenUsageData, // Now properly typed as TokenStatusResponse | undefined
    tokenUsageError // Expose error for better error handling
  };
}
