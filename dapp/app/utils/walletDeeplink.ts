// app/utils/walletDeeplink.ts

export const DUMMY_WALLETCONNECT_URI = 'wc:ritoswap'

export function openWalletDeeplink(uri: string = DUMMY_WALLETCONNECT_URI): void {
  if (typeof window === 'undefined') return
  // Add timestamp to force browser to treat as new navigation each time
  const deeplinkUri = uri === DUMMY_WALLETCONNECT_URI
    ? `${uri}?t=${Date.now()}`
    : uri
  window.location.href = deeplinkUri
}

