import React from 'react';

export function FooterStoryFrame({
  children,
  width,
  padding = 24,
}: {
  children: React.ReactNode;
  width?: number | string;
  padding?: number;
}) {
  const resolvedWidth = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      style={{
        background: '#012035',
        padding,
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div
        style={{
          width: resolvedWidth,
          maxWidth: '90vw',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function PreventNavigation({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.('a');
        if (!anchor) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

