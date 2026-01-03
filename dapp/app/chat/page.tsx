

import ChatBot from '@/components/chatBot';
import styles from './page.module.css';

export default function ChatPage() {
  return (
    <div className={styles.pageContainer}>
      <ChatBot />
    </div>
  );
}