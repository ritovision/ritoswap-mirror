// app/store/nftStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Address } from 'viem'

interface NFTState {
  // Core state
  hasNFT: boolean
  tokenId: number | null
  backgroundColor: string | null
  keyColor: string | null
  isLoading: boolean
  error: string | null
  
  // Token gate state (for future use)
  hasUsedTokenGate: boolean
  
  // Wallet state
  currentAddress: Address | null
  
  // Account switching state
  isSwitchingAccount: boolean
  previousData: {
    hasNFT: boolean
    tokenId: number | null
    backgroundColor: string | null
    keyColor: string | null
  } | null
  
  // Actions
  setHasNFT: (hasNFT: boolean) => void
  setTokenData: (tokenId: number | null, backgroundColor: string | null, keyColor: string | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setHasUsedTokenGate: (hasUsed: boolean) => void
  setCurrentAddress: (address: Address | null) => void
  setIsSwitchingAccount: (isSwitching: boolean) => void
  startAccountSwitch: () => void
  completeAccountSwitch: () => void
  resetState: () => void
}

const initialState = {
  hasNFT: false,
  tokenId: null,
  backgroundColor: null,
  keyColor: null,
  isLoading: false,
  error: null,
  hasUsedTokenGate: false,
  currentAddress: null,
  isSwitchingAccount: false,
  previousData: null,
}

export const useNFTStore = create<NFTState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setHasNFT: (hasNFT) => set({ hasNFT }),
      
      setTokenData: (tokenId, backgroundColor, keyColor) => {
        const state = get()
        if (state.isSwitchingAccount) {
          // If we're switching accounts, complete the switch
          set({ 
            tokenId, 
            backgroundColor, 
            keyColor, 
            hasNFT: tokenId !== null,
            isSwitchingAccount: false,
            previousData: null
          })
        } else {
          // Normal update
          set({ 
            tokenId, 
            backgroundColor, 
            keyColor, 
            hasNFT: tokenId !== null 
          })
        }
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      setHasUsedTokenGate: (hasUsed) => set({ hasUsedTokenGate: hasUsed }),
      
      setCurrentAddress: (address) => set({ currentAddress: address }),
      
      setIsSwitchingAccount: (isSwitching) => set({ isSwitchingAccount: isSwitching }),
      
      startAccountSwitch: () => {
        const state = get()
        set({
          isSwitchingAccount: true,
          previousData: {
            hasNFT: state.hasNFT,
            tokenId: state.tokenId,
            backgroundColor: state.backgroundColor,
            keyColor: state.keyColor,
          }
        })
      },
      
      completeAccountSwitch: () => {
        set({
          isSwitchingAccount: false,
          previousData: null
        })
      },
      
      resetState: () => {
        const currentTokenGateStatus = get().hasUsedTokenGate
        const currentAddress = get().currentAddress
        set({
          ...initialState,
          // Preserve token gate usage and address across resets
          hasUsedTokenGate: currentTokenGateStatus,
          currentAddress: currentAddress,
        })
      },
    }),
    {
      name: 'nft-storage',
      partialize: (state) => ({
        // Only persist token gate usage
        hasUsedTokenGate: state.hasUsedTokenGate,
      }),
    }
  )
)