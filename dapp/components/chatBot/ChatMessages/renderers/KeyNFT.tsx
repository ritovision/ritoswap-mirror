'use client';
import React from 'react';

export interface KeyNFTProps {
  bgColor?: string;
  keyColor?: string;
  width?: number | string;
  height?: number | string;
}

export default function KeyNFT({
  bgColor = '#222',
  keyColor = '#ffd700',
  width = 200,
  height = 100,
}: KeyNFTProps) {
  return (
    <svg
      viewBox="0 0 200 100"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Key NFT"
    >
      <rect x="0" y="0" width="200" height="100" fill={bgColor} />
      <circle cx="60" cy="50" r="20" fill="none" stroke={keyColor} strokeWidth={10} />
      <rect x="80" y="45" width="100" height="10" rx={5} fill={keyColor} />
      <path d="M145 30 A5 5 0 0 1 150 35 V46 H140 V35 A5 5 0 0 1 145 30 Z" fill={keyColor} />
      <path d="M165 36 A5 5 0 0 1 170 41 V46 H160 V41 A5 5 0 0 1 165 36 Z" fill={keyColor} />
    </svg>
  );
}
