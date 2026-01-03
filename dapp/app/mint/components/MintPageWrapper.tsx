// app/mint/components/MintPageWrapper.tsx
"use client"

import React, { useEffect, useRef } from "react"
import styles from "./MintPageWrapper.module.css"
import TokenStatus from "./TokenStatus/TokenStatus"
import NFTScreen from "./NFTScreen/NFTScreen"
import ButtonSection from "./ButtonSection/ButtonSection"
import InlineErrorBoundary from "@/components/errors/InlineErrorBoundary"
import { useAccount, useWatchContractEvent } from "wagmi"
import { fullKeyTokenAbi, KEY_TOKEN_ADDRESS } from "@config/contracts"
import type { Address } from "viem"
import { useNFTData } from "@/app/hooks/useNFTData"
import { sendNotificationEvent } from "@/app/lib/notifications"

export default function MintPageWrapper() {
  const { address } = useAccount()
  const { forceRefresh } = useNFTData()

  const transferTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useWatchContractEvent({
    address: KEY_TOKEN_ADDRESS,
    abi: fullKeyTokenAbi,
    eventName: "Transfer",
    onLogs(logs) {
      if (!address) return
      for (const log of logs) {
        const args = log.args as { from?: Address; to?: Address; tokenId?: bigint }
        if (!args?.from || !args?.to) continue
        const involvesUser = args.from === address || args.to === address
        if (!involvesUser) continue

        if (args.to === address) {
          sendNotificationEvent('NFT_RECEIVED', { source: 'watcher' })
        } else if (args.from === address) {
          sendNotificationEvent('NFT_TRANSFERRED', { source: 'watcher' })
        }

        if (transferTimeoutRef.current) clearTimeout(transferTimeoutRef.current)
        transferTimeoutRef.current = setTimeout(() => {
          forceRefresh()
          transferTimeoutRef.current = null
        }, 1500)
      }
    },
  })

  useEffect(() => {
    return () => {
      if (transferTimeoutRef.current) clearTimeout(transferTimeoutRef.current)
    }
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <InlineErrorBoundary
          component="mint-token-status"
          title="Status unavailable"
        >
          <TokenStatus />
        </InlineErrorBoundary>
        <InlineErrorBoundary
          component="mint-nft-screen"
          title="NFT preview unavailable"
        >
          <NFTScreen />
        </InlineErrorBoundary>
        <InlineErrorBoundary
          component="mint-button-section"
          title="Mint actions unavailable"
        >
          <ButtonSection onRefresh={forceRefresh} />
        </InlineErrorBoundary>
      </div>
    </div>
  )
}
