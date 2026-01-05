import type { KeyboardEvent } from 'react'
import { TOCItem } from '@Contexts/TOCContext'
import styles from './TOCDrawer.module.css'

interface TOCDrawerProps {
  toc: TOCItem[]
  activeId: string
  onHeadingClick: (id: string) => void
  onKeyDown: (event: KeyboardEvent, id: string) => void
}

export default function TOCDrawer({
  toc,
  activeId,
  onHeadingClick,
  onKeyDown,
}: TOCDrawerProps) {
  const hasTOC = toc && toc.length > 0

  return (
    <div className={styles.tocList}>
      {hasTOC && (
        <ul className={styles.tocItems}>
          {toc.map((item) => (
            <li
              key={item.id}
              className={`${styles.tocItem} ${styles[`depth-${item.depth}`]} ${
                activeId === item.id ? styles.active : ''
              }`}
            >
              <a
                href={`#${item.id}`}
                className={styles.tocLink}
                onClick={(e) => {
                  e.preventDefault()
                  onHeadingClick(item.id)
                }}
                onKeyDown={(e) => onKeyDown(e, item.id)}
                tabIndex={0}
              >
                {item.value}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
