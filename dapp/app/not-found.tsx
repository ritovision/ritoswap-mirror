'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './not-found.module.css'

export default function NotFound() {
const router = useRouter()

useEffect(() => {
const timer = setTimeout(() => {
router.push('/')
}, 5000)
return () => clearTimeout(timer)
}, [router])

return (
<div className={styles.container}>
<h1 className={styles.title}>404 — Page Not Found</h1>
<p className={styles.message}>
Oops! The page you’re looking for doesn’t exist. You’ll be redirected to the homepage shortly.
</p>
<p className={styles.link}>
If you’re not sent back automatically, <Link href="/">click here</Link>.
</p>
</div>
)
}