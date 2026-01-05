// app/layout.tsx
import Image from 'next/image'
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import type { ReactNode } from 'react'
import 'nextra-theme-docs/style.css'
import '../styles/override.css'

export const metadata = {
  title: 'RitoSwap Documentation',
  description: 'Documentation for colored-keys, local-network, and dapp',
  icons: { icon: '/SEO/favicon.png' },
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const pageMap = await getPageMap()

  
  const navbar = (
    <Navbar
      logo={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src="/brand/logos/ritoswap.png"
            alt="RitoSwap"
            width={140}
            height={32}
          />
          <span
            style={{
              marginLeft: 8,
              fontWeight: 1,
              fontSize: 28,
              color: 'var(--accent-color)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Docs
          </span>
        </div>
      }
      projectLink="https://github.com/ritovision/ritoswap-mirror"
      
    />
  )

  const footer = (
    <Footer>
  <a
    href="https://ritovision.com"
    target="_blank"
    rel="noopener noreferrer"
    style={{ textDecoration: 'none' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Image
        src="/brand/logos/ritovision-wordmark-tm.png"
        alt="Ritovision"
        width={150}
        height={24}
        style={{ marginBottom: '10px' }}
      />
      <span
        style={{
          color: 'var(--accent-color)',
          fontFamily: 'var(--font-primary)',
          fontSize: 20,
        }}
      >
        © {new Date().getFullYear()}
      </span>
    </div>
  </a>
</Footer>
  )

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <body>
        <Layout
          banner={<Banner storageKey="welcome-banner">Welcome to RitoSwap's documentation!</Banner>}
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/ritovision/ritoswap-mirror/tree/main/docs"
          footer={footer}
          sidebar={{
            defaultMenuCollapseLevel: 1,
            toggleButton: true,
            autoCollapse: true,
          }}
          toc={{ float: true, title: 'On This Page' }}
          editLink={<>Edit this page on GitHub →</>}
          feedback={{ content: 'Question? Give us feedback →', labels: 'feedback' }}
          navigation
          darkMode={false}
          nextThemes={{
            defaultTheme: 'dark',
            forcedTheme: 'dark',
            disableTransitionOnChange: true,
            storageKey: 'theme',
            attribute: 'class',
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
