import { act, renderHook } from '@testing-library/react'
import { useNFTStore } from '../nftStore'

describe('NFT Store', () => {
  // Reset store before each test
  beforeEach(() => {
    const { resetState } = useNFTStore.getState()
    act(() => resetState())
  })

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useNFTStore())
    
    expect(result.current.hasNFT).toBe(false)
    expect(result.current.tokenId).toBe(null)
    expect(result.current.backgroundColor).toBe(null)
    expect(result.current.keyColor).toBe(null)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should set NFT ownership', () => {
    const { result } = renderHook(() => useNFTStore())
    
    act(() => {
      result.current.setHasNFT(true)
    })
    
    expect(result.current.hasNFT).toBe(true)
  })

  it('should set token data and update hasNFT accordingly', () => {
    const { result } = renderHook(() => useNFTStore())
    
    // Setting token data with valid tokenId should set hasNFT to true
    act(() => {
      result.current.setTokenData(123, '#FF0000', '#00FF00')
    })
    
    expect(result.current.tokenId).toBe(123)
    expect(result.current.backgroundColor).toBe('#FF0000')
    expect(result.current.keyColor).toBe('#00FF00')
    expect(result.current.hasNFT).toBe(true)
    
    // Setting tokenId to null should set hasNFT to false
    act(() => {
      result.current.setTokenData(null, null, null)
    })
    
    expect(result.current.tokenId).toBe(null)
    expect(result.current.hasNFT).toBe(false)
  })

  it('should handle account switching flow', () => {
    const { result } = renderHook(() => useNFTStore())
    
    // Set initial data
    act(() => {
      result.current.setTokenData(123, '#FF0000', '#00FF00')
    })
    
    // Start account switch
    act(() => {
      result.current.startAccountSwitch()
    })
    
    expect(result.current.isSwitchingAccount).toBe(true)
    expect(result.current.previousData).toEqual({
      hasNFT: true,
      tokenId: 123,
      backgroundColor: '#FF0000',
      keyColor: '#00FF00',
    })
    
    // Complete switch with new data
    act(() => {
      result.current.setTokenData(456, '#0000FF', '#FFFF00')
    })
    
    expect(result.current.isSwitchingAccount).toBe(false)
    expect(result.current.previousData).toBe(null)
    expect(result.current.tokenId).toBe(456)
  })

  it('should preserve token gate status on reset', () => {
    const { result } = renderHook(() => useNFTStore())
    
    // Set token gate as used
    act(() => {
      result.current.setHasUsedTokenGate(true)
      result.current.setCurrentAddress('0x123' as any)
    })
    
    // Reset state
    act(() => {
      result.current.resetState()
    })
    
    // Token gate status and address should be preserved
    expect(result.current.hasUsedTokenGate).toBe(true)
    expect(result.current.currentAddress).toBe('0x123')
    
    // Other state should be reset
    expect(result.current.hasNFT).toBe(false)
    expect(result.current.tokenId).toBe(null)
  })

  it('should handle loading and error states', () => {
    const { result } = renderHook(() => useNFTStore())
    
    act(() => {
      result.current.setLoading(true)
    })
    expect(result.current.isLoading).toBe(true)
    
    act(() => {
      result.current.setLoading(false)
      result.current.setError('Something went wrong')
    })
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Something went wrong')
  })
})