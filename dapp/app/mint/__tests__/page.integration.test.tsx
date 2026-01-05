// app/mint/__tests__/page.integration.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import * as jsonld from '@lib/jsonld/loadJsonFromIndex';
import jsonLdData from '../jsonld';
import MintPage from '../page';
import { mintPageMetadata } from '../metadata';

vi.mock('@lib/jsonld/loadJsonFromIndex');

// Mock child components
vi.mock('../components/MintPageWrapper', () => ({
  default: () => <div data-testid="mint-page-wrapper">MintPageWrapper</div>,
}));
vi.mock('../components/Instructions/Instructions', () => ({
  default: () => <div data-testid="instructions">Instructions</div>,
}));
vi.mock('../components/Music', () => ({
  default: () => <div data-testid="music">Music</div>,
}));

describe('MintPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all page components', () => {
    render(<MintPage />);
    
    expect(screen.getByTestId('mint-page-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('instructions')).toBeInTheDocument();
    expect(screen.getByTestId('music')).toBeInTheDocument();
  });

  it('calls loadJsonLdScripts with correct data', () => {
    render(<MintPage />);
    
    expect(jsonld.loadJsonLdScripts).toHaveBeenCalledWith(jsonLdData, 'mint-jsonld');
  });

  it('exports correct metadata', () => {
    expect(mintPageMetadata).toEqual({
      title: "Mint | RitoSwap",
      description: "Mint your Colored Key NFT on RitoSwap to gain access to exclusive features and channels.",
      alternates: {
        canonical: "https://ritoswap.com/mint",
      },
      openGraph: expect.objectContaining({
        title: "Mint | RitoSwap",
        description: "Mint your Colored Key NFT on RitoSwap to gain access to exclusive features and channels.",
        url: "https://ritoswap.com/mint",
        siteName: "RitoSwap",
      }),
      twitter: expect.objectContaining({
        card: "summary_large_image",
        title: "Mint | RitoSwap",
        description: "Mint your Colored Key NFT on RitoSwap to gain access to exclusive features and channels.",
        site: "@rito_rhymes",
      }),
    });
  });

  it('renders music component with proper centering styles', () => {
    const { container } = render(<MintPage />);
    
    const musicWrapper = container.querySelector('[style*="width: 90%"]');
    expect(musicWrapper).toBeInTheDocument();
    expect(musicWrapper).toHaveStyle({
      width: '90%',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'center',
    });
  });
});