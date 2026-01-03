// File: components/navigation/mobileNav/MobileNav.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import MenuLinks from "@/components/navigation/menuLinks/MenuLinks";
import styles from "./MobileNav.module.css";

interface MobileNavProps {
  /** Ref for click-outside detection */
  innerRef: React.RefObject<HTMLDivElement>;
  /** Called to close the menu */
  onClose: () => void;
}

export default function MobileNav({ innerRef, onClose }: MobileNavProps) {
  return (
    <motion.div
      ref={innerRef}
      className={styles.container}
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <MenuLinks onClick={onClose} />
    </motion.div>
  );
}
