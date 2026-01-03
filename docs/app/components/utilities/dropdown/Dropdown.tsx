'use client';
import React, { useState, useRef, useEffect } from 'react';
import styles from './Dropdown.module.css';

export type DropdownState = 'pre' | 'valid' | 'invalid' | 'disabled';

interface DropdownProps {
  title?: string;
  label?: string;
  items: string[];
  state?: DropdownState;
  selectedValue?: string;
  onChange?: (val: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  title,
  label = 'Select an option',
  items,
  state = 'pre',
  selectedValue,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Internal state is only used when `selectedValue` is not provided (uncontrolled mode)
  const [internal, setInternal] = useState(selectedValue ?? '');
  const ref = useRef<HTMLDivElement>(null);

  // Compute what should be displayed:
  // - If parent passes `selectedValue`, that always wins.
  // - Otherwise, fall back to internal state.
  const displayValue = selectedValue ?? internal;

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const toggle = () => {
    if (state !== 'disabled') setIsOpen((o) => !o);
  };

  const pick = (val: string) => {
    setInternal(val);       // keeps value for uncontrolled usage
    setIsOpen(false);
    onChange?.(val);        // lets parent update selectedValue if it wants to control
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, val: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(val);
    }
  };

  return (
    <div className={styles.dropdownContainer} ref={ref}>
      {title && (
        <div className={styles.dropdownTitle}>
          {title}
        </div>
      )}

      <div
        className={`${styles.dropdownButton} ${
          state === 'disabled' ? styles.disabled : ''
        } ${isOpen ? styles.open : ''}`}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={title || label}
      >
        <span className={styles.displayText}>
          {displayValue || label}
        </span>
        <svg
          width="12"
          height="12"
          className={`${styles.triangleIcon} ${
            isOpen ? styles.triangleUp : styles.triangleDown
          }`}
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1 L5 5 L9 1"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </div>

      {isOpen && (
        <div className={styles.dropdownListWrapper}>
          <div className={styles.middleSection}>
            <ul className={styles.dropdownList} role="listbox">
              {items.map((it) => (
                <li
                  key={it}
                  className={styles.dropdownItem}
                  onClick={() => pick(it)}
                  onKeyDown={(e) => handleItemKeyDown(e, it)}
                  role="option"
                  tabIndex={0}
                  aria-selected={it === displayValue}
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