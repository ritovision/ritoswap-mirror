'use client';
import React, { useEffect, useRef, useState, ReactNode } from 'react';
import CustomAudioPlayer from './CustomAudioPlayer';
import styles from './AudioWrapper.module.css';

export type AudioWrapperProps = {
  headline: string;
  imageSrc: string;
  imageAlt: string;
  description: ReactNode;
  title: string;
  audioSrc: string;
  id?: string;
};

export default function AudioWrapper({
  headline,
  imageSrc,
  imageAlt,
  description,
  title,
  audioSrc,
  id,
}: AudioWrapperProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      className={`${styles.wrapper} ${isVisible ? styles.visible : ''}`}
    >
      <h2 className={styles.headline}>{headline}</h2>
      <div className={styles.content}>
        <div className={styles.left}>
          <div className={styles.imageContainer}>
            <img src={imageSrc} alt={imageAlt} className={styles.image} />
          </div>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.right}>
          <div className={styles.audioWrapper}>
            <CustomAudioPlayer title={title} audioSrc={audioSrc} />
          </div>
        </div>
      </div>
    </section>
  );
}