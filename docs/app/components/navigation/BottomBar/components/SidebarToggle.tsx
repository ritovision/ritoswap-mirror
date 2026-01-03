import styles from '../BottomBar.module.css'

interface SidebarToggleProps {
  sidebarExpanded: boolean | null
  onToggle: () => void
}

export function SidebarToggle({ sidebarExpanded, onToggle }: SidebarToggleProps) {
  return (
    <div className={styles.sidebarButton}>
      <button
        className="x:transition x:cursor-pointer x:rounded-md x:p-2 x:text-gray-600 x:dark:text-gray-400"
        aria-expanded={sidebarExpanded ?? true}
        aria-controls="«R1brlql7»"
        title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        type="button"
        data-headlessui-state=""
        onClick={onToggle}
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          height="12"
          className={sidebarExpanded ? '' : 'x:*:first:origin-[35%] x:*:first:rotate-180'}
        >
          <path d="M4.177 7.823l2.396-2.396A.25.25 0 017 5.604v4.792a.25.25 0 01-.427.177L4.177 8.177a.25.25 0 010-.354z"></path>
          <path
            fillRule="evenodd"
            d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25H9.5v-13H1.75zm12.5 13H11v-13h3.25a.25.25 0 01.25.25v12.5a.25.25 0 01-.25.25z"
          ></path>
        </svg>
      </button>
    </div>
  )
}
