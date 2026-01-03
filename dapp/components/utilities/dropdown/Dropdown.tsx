// app/components/utilities/dropdown/Dropdown.tsx
'use client';
import React, { useState, useRef, useEffect, useId } from 'react';
import styles from './Dropdown.module.css';

export type DropdownState = 'pre' | 'valid' | 'invalid' | 'disabled';

interface DropdownProps {
  label?: string;
  items: string[];
  state?: DropdownState;
  selectedValue?: string;
  onChange?: (val: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  label = 'Select an option',
  items,
  state = 'pre',
  selectedValue,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internal, setInternal] = useState(selectedValue ?? '');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // stable id (useId is pure / SSR-friendly)
  const reactId = useId();
  const dropdownId = `dropdown-${reactId.replace(/:/g, '')}`;
  const listboxId = `${dropdownId}-listbox`;

  useEffect(() => {
    if (selectedValue !== undefined) {
      setTimeout(() => setInternal(selectedValue), 0);
    }
  }, [selectedValue]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const optionEls = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
      optionEls[focusedIndex]?.focus();
    }
  }, [focusedIndex, isOpen]);

  const toggle = () => {
    if (state === 'disabled') return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setFocusedIndex(items.indexOf(internal));
      }
      return next;
    });
  };

  const pick = (val: string) => {
    setInternal(val);
    setIsOpen(false);
    onChange?.(val);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement | HTMLLIElement>) => {
    if (state === 'disabled') return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(items.indexOf(internal));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          pick(items[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
    }
  };

  const containerCls = [styles.dropdownContainer, styles[state], isOpen ? styles.open : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerCls} ref={containerRef}>
      <div
        ref={buttonRef}
        className={[
          styles.dropdownButton,
          isOpen ? styles.dropdownButtonOpen : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={label}
        aria-disabled={state === 'disabled'}
        tabIndex={state === 'disabled' ? -1 : 0}
      >
        <span className={styles.displayText}>{internal || label}</span>
        <svg
          width="12"
          height="12"
          className={`${styles.triangleIcon} ${isOpen ? styles.triangleUp : styles.triangleDown}`}
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
        >
          <path d="M1 1 L5 5 L9 1" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {isOpen && (
        <div className={styles.dropdownListWrapper}>
          <div className={styles.middleSection}>
            <ul
              ref={listRef}
              id={listboxId}
              className={styles.dropdownList}
              role="listbox"
              aria-label={label}
            >
              {items.map((it, index) => (
                <li
                  key={it}
                  className={`${styles.dropdownItem} ${focusedIndex === index ? styles.focused : ''}`}
                  onClick={() => pick(it)}
                  onKeyDown={handleKeyDown}
                  role="option"
                  aria-selected={internal === it}
                  tabIndex={focusedIndex === index ? 0 : -1}
                >
                  {it}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.bottomSection} aria-hidden="true" />
        </div>
      )}
    </div>
  );
};

export default Dropdown;
