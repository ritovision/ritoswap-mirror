'use client'

import React, { useRef, useEffect, ReactNode } from 'react'
import styles from './HomeGrid.module.css'

export type HomeGridItem = {
  id: number
  title: ReactNode
  description: ReactNode
  href: string
  imageSrc: string
}

const defaultItems: HomeGridItem[] = [
  {
    id: 1,
    title: <>Trade</>,
    description: <>Swap til your heart's content, across chains even... Rito won't stop you</>,
    href: '/swap',
    imageSrc: '/images/home/trade.jpg',
  },
  {
    id: 2,
    title: <>Mint</>,
    description: <>Forge one-of-a-kind collectibles that do more than just collect dust</>,
    href: '/mint',
    imageSrc: '/images/home/mint.jpg',
  },
  {
    id: 3,
    title: <>Burn</>,
    description: <>Sometimes tokens gotta go. Let 'em burn!</>,
    href: '/mint',
    imageSrc: '/images/home/burn.jpg',
  },
  {
    id: 4,
    title: <>RapBotRito AI</>,
    description: <>Meet the rapping multi-modal agentic chatbot who will rap battle you, create and share images and even interact directly with the blockchain</>,
    href: '/gate',
    imageSrc: '/images/home/glitchy-rapbotrito.jpg',
  },
  {
    id: 5,
    title: <>Music</>,
    description: <>Enjoy fire crypto anthems by Rito Rhymes</>,
    href: '#crypto-music',
    imageSrc: '/images/home/boombox.jpg',
  },
  {
    id: 6,
    title: <>Unlock</>,
    description: <>Access an exclusive token-gate with perks like unreleased music, RapBotRito AI and a special form to send a message to Rito</>,
    href: '/gate',
    imageSrc: '/images/home/unlock.jpg',
  },
]

export default function HomeGrid({ items = defaultItems }: { items?: HomeGridItem[] }) {
  const refs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.4 }
    )

    refs.current.forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  return (
    <div className={styles.grid}>
      {items.map((item, i) => (
        <a
          key={item.id}
          href={item.href}
          ref={el => (refs.current[i] = el)}
          className={`${styles.card} ${styles.hidden}`}
        >
          <div className={styles.top}>{item.title}</div>
          <div className={styles.middle}>
            <img src={item.imageSrc} alt={typeof item.title === 'string' ? item.title : ''} />
          </div>
          <div className={styles.bottom}>{item.description}</div>
        </a>
      ))}
    </div>
  )
}
