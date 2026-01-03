// app/layout.tsx
import "../styles/globals.css"
import { Providers } from "@components/providers/providers"
import TopNav from "../components/navigation/topNav/TopNav"
import Hamburger from "../components/navigation/mobileNav/Hamburger"
import BottomNav from "../components/navigation/bottomNav/BottomNav"
import { ChainInfoProvider } from "@components/providers/ChainInfoProvider"
import FooterWrapper from "../components/footer/FooterWrapper"
import { Toaster } from "react-hot-toast"
import NetworkStatusProvider from '@/components/utilities/offline/NetworkStatusProvider'
import WalletModalHost from '@/components/wallet/connectModal/WalletModalHost'

// root metadata
import { metadata as rootMetadata } from "./metadata"

// json-ld loader & global nav schema
import { loadJsonLdScripts } from "@lib/jsonld/loadJsonFromIndex"
import globalJsonLdData from "./_data/jsonld/global"

// ✅ add validate import
import { validateEnvironment } from "@config/validate"
// ✅ import public env + derived node flags
import { publicEnv, publicConfig } from "@config/public.env"

import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"

const agencyB = localFont({
  src: [{ path: "../public/fonts/AGENCYB.woff", weight: "400", style: "normal" }],
  variable: "--font-primary",
  display: "swap",
})

const youngAgency = localFont({
  src: [{ path: "../public/fonts/YoungAgency-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-h6",
  display: "swap",
})

const michroma = localFont({
  src: [{ path: "../public/fonts/Michroma-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-body",
  display: "swap",
})

// ✅ Keep only supported metadata keys here (no viewport/themeColor)
export const metadata: Metadata = {
  ...rootMetadata,
  metadataBase: new URL(
    `${publicConfig.isDevelopment ? "http" : "https"}://${publicEnv.NEXT_PUBLIC_DOMAIN}`
  ),
  manifest: "/manifest.json",
  icons: {
    icon: "/images/SEO/favicon.png",
    shortcut: "/images/SEO/favicon.png",
    apple: "/images/SEO/favicon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "contain",
  themeColor: "#012035",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ✅ run environment validation on the server
  await validateEnvironment()

  return (
    <html lang="en" className={`${agencyB.variable} ${michroma.variable} ${youngAgency.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/images/SEO/favicon.png" />

        {/* inject global JSON-LD (site navigation) */}
        {loadJsonLdScripts(globalJsonLdData, "global-jsonld")}
      </head>
      <body>
        <Providers>
          <NetworkStatusProvider>
            <ChainInfoProvider>
              <TopNav />
              <Hamburger />
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: "black",
                    color: "white",
                    border: "var(--default-border)",
                    borderRadius: "12px",
                    fontFamily: "var(--font-primary)",
                    padding: "1rem 2rem",
                    maxHeight: "12rem",
                    overflowY: "auto",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  },
                  success: {
                    style: {
                      background: "var(--primary-color)",
                      border: "2px solid var(--utility-green)",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    },
                    iconTheme: {
                      primary: "var(--secondary-color)",
                      secondary: "var(--utility-green)",
                    },
                  },
                  error: {
                    style: {
                      background: "black",
                      border: "2px solid var(--accent-color)",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    },
                    iconTheme: {
                      primary: "var(--accent-color)",
                      secondary: "#fff",
                    },
                  },
                }}
              />
              <BottomNav />
              <FooterWrapper />
              <WalletModalHost />
            </ChainInfoProvider>
          </NetworkStatusProvider>
        </Providers>
      </body>
    </html>
  )
}
