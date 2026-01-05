"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "./ImageQuote.module.css";

interface ImageTextPair {
  image: string;
  text: string;
}

export default function ImageQuoteClient({ imageTextPairs }: { imageTextPairs: ImageTextPair[] }) {
  const [currentPair, setCurrentPair] = useState<ImageTextPair | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const hasPairs = !!imageTextPairs && imageTextPairs.length > 0;

  // Randomly pick an image-text pair on mount AND on route changes
  useEffect(() => {
    if (!hasPairs) return;

    if (containerRef.current) {
      containerRef.current.classList.remove(styles.visible);
    }

    const timer = setTimeout(() => {
      setCurrentPair(imageTextPairs[Math.floor(Math.random() * imageTextPairs.length)]);
    }, 10);

    return () => clearTimeout(timer);
  }, [hasPairs, imageTextPairs, pathname]);

  // Intersection Observer for fade-in effect
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [pathname, currentPair]); // Re-create observer on route change and image change

  if (!hasPairs || !currentPair) {
    return <p>Loading...</p>;
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <img src={currentPair.image} alt="Random visual" className={styles.image} />
      <div className={styles.overlay}>
        <p className={styles.text}>"{currentPair.text}"</p>
      </div>
    </div>
  );
}
