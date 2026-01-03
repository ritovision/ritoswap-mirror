// app/gate/components/TabsContainer/TabsContainer.tsx
"use client";

import React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import styles from "./TabsContainer.module.css";
import InlineErrorBoundary from "@/components/errors/InlineErrorBoundary";

interface TabsContainerProps {
  messageContent: React.ReactNode;
  musicContent: React.ReactNode;
  chatbotContent: React.ReactNode;
}

export default function TabsContainer({
  messageContent,
  musicContent,
  chatbotContent,
}: TabsContainerProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Token Gate Rooms</h1>

      <Tabs.Root className={styles.tabsRoot} defaultValue="message">
        <Tabs.List className={styles.tabsList}>
          <Tabs.Trigger className={styles.tabsTrigger} value="message">
            Msg Rito
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="music">
            Secret Song
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="chatbot">
            RapBotRito
          </Tabs.Trigger>
        </Tabs.List>

        {/* Keep panels mounted so event handlers and DOM state persist */}
        <Tabs.Content className={styles.tabsContent} value="message" forceMount>
          <InlineErrorBoundary
            component="gate-tab-message"
            title="Message area unavailable"
          >
            {messageContent}
          </InlineErrorBoundary>
        </Tabs.Content>

        <Tabs.Content className={styles.tabsContent} value="music" forceMount>
          <InlineErrorBoundary
            component="gate-tab-music"
            title="Music unavailable"
          >
            {musicContent}
          </InlineErrorBoundary>
        </Tabs.Content>

        <Tabs.Content className={styles.tabsContent} value="chatbot" forceMount>
          <InlineErrorBoundary
            component="gate-tab-chatbot"
            title="Chat unavailable"
          >
            {chatbotContent}
          </InlineErrorBoundary>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
