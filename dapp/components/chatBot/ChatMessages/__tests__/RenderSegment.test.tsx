// dapp/components/chatBot/ChatMessages/__tests__/RenderSegment.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { type Mock } from 'vitest';
import RenderSegment from '../RenderSegment';
import type { MediaSegment } from '../types';

// Stub CSS module (keeps className checks simple even with css:false)
vi.mock('../ChatMessages.module.css', () => ({
  default: {
    heading: 'heading',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
  },
}));

// Mock child renderers to simple markers so we can assert props
const LinkRendererMock = vi.fn(({ label, href, role }: any) => (
  <a data-testid="link" data-role={role} href={href}>{label}</a>
));
const SvgRendererMock = vi.fn(({ svgString }: any) => (
  <div data-testid="svg" data-content={svgString} />
));
const ImageRendererMock = vi.fn(({ src, alt, width, height }: any) => (
  <img data-testid="image" src={src} alt={alt} width={width} height={height} />
));
const GifRendererMock = vi.fn(({ src, alt, width, height }: any) => (
  <div data-testid="gif" data-src={src} data-alt={alt} data-width={width ?? ''} data-height={height ?? ''} />
));
const ChainLogoMock = vi.fn(({ chainName, size }: any) => (
  <div data-testid="chainLogo" data-name={chainName} data-size={size ?? ''} />
));
const MusicCommandRendererMock = vi.fn(({ seg }: any) => (
  <div data-testid="music" data-action={seg.action ?? ''} data-song={seg.song ?? ''} />
));
const GoodbyeRendererMock = vi.fn(({ width, height, seconds }: any) => (
  <div data-testid="goodbye" data-w={width} data-h={height} data-s={seconds} />
));

vi.mock('../renderers', () => ({
  KeyNFT: () => null,
  ChainLogo: (props: any) => ChainLogoMock(props),
  ImageRenderer: (props: any) => ImageRendererMock(props),
  SvgRenderer: (props: any) => SvgRendererMock(props),
  LinkRenderer: (props: any) => LinkRendererMock(props),
  MusicCommandRenderer: (props: any) => MusicCommandRendererMock(props),
  GifRenderer: (props: any) => GifRendererMock(props),
  GoodbyeRenderer: (props: any) => GoodbyeRendererMock(props),
}));

// Mock extractImgAttrs so we control image parsing behavior
import * as imgHelpers from '../utils/imageHelpers';
vi.mock('../utils/imageHelpers', async (orig) => {
  const mod = await (orig as any)();
  return {
    ...mod,
    extractImgAttrs: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RenderSegment', () => {
  // helper that matches exact textContent (including leading/trailing spaces)
  const hasExactText = (txt: string) => (_: unknown, node: Element | null) =>
    !!node && node.textContent === txt;

  it('renders formattedText with inline runs (text/strong/em)', () => {
    const seg: MediaSegment = {
      type: 'formattedText',
      inline: [
        { type: 'text', content: 'hello ' },
        { type: 'strong', content: 'bold' },
        { type: 'em', content: ' ital' },
      ],
    } as any;

    render(<RenderSegment segment={seg} role="assistant" />);

    // exact-match the span containing "hello " (includes trailing space)
    expect(screen.getByText(hasExactText('hello '))).toBeInTheDocument();

    expect(screen.getByText('bold').tagName.toLowerCase()).toBe('strong');

    // exact-match the em node including its leading space
    const emNode = screen.getByText(hasExactText(' ital'));
    expect(emNode.tagName.toLowerCase()).toBe('em');
  });

  it('renders heading with correct tag and classes', () => {
    const seg: MediaSegment = {
      type: 'heading',
      level: 3,
      inline: [{ type: 'text', content: 'Title!' }],
    } as any;

    render(<RenderSegment segment={seg} role="assistant" />);
    const heading = screen.getByRole('heading', { name: 'Title!' });
    expect(heading.tagName.toLowerCase()).toBe('h3');
    expect(heading.className).toContain('heading');
    expect(heading.className).toContain('h3');
  });

  it('renders plain text segments', () => {
    const seg: MediaSegment = { type: 'text', content: 'plain' };
    render(<RenderSegment segment={seg} role="user" />);
    expect(screen.getByText('plain')).toBeInTheDocument();
  });

  it('renders link via LinkRenderer and passes role', () => {
    const seg: MediaSegment = { type: 'link', label: 'click', href: 'https://example.com' };
    render(<RenderSegment segment={seg} role="user" />);
    const a = screen.getByTestId('link');
    expect(a).toHaveAttribute('href', 'https://example.com');
    expect(a).toHaveTextContent('click');
    expect(a).toHaveAttribute('data-role', 'user');
    expect(LinkRendererMock).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'click', href: 'https://example.com', role: 'user' })
    );
  });

  it('renders svg via SvgRenderer', () => {
    const seg: MediaSegment = { type: 'svg', content: '<svg/>' };
    render(<RenderSegment segment={seg} role="assistant" />);
    expect(screen.getByTestId('svg')).toHaveAttribute('data-content', '<svg/>');
  });

  it('returns null for image when extractImgAttrs yields empty src', () => {
    ((imgHelpers.extractImgAttrs as unknown) as Mock).mockReturnValue({ src: '', alt: 'x' });
    const seg: MediaSegment = { type: 'image', content: '<img />' } as any;
    const { container } = render(<RenderSegment segment={seg} role="assistant" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders image when extractImgAttrs returns src and coalesces numeric dimensions', () => {
    ((imgHelpers.extractImgAttrs as unknown) as Mock).mockReturnValue({
      src: '/img.png',
      alt: 'A',
      width: '100',
      height: '50',
    });
    const seg: MediaSegment = { type: 'image', content: '<img />' } as any;
    render(<RenderSegment segment={seg} role="assistant" />);
    const img = screen.getByTestId('image');
    expect(img).toHaveAttribute('src', '/img.png');
    expect(img).toHaveAttribute('alt', 'A');
    expect(ImageRendererMock).toHaveBeenCalledWith(
      expect.objectContaining({ src: '/img.png', alt: 'A', width: 100, height: 50 })
    );
  });

  it('renders gif via GifRenderer with forwarded props', () => {
    const seg: MediaSegment = { type: 'gif', src: '/g.gif', alt: 'g', width: 120, height: 80 } as any;
    render(<RenderSegment segment={seg} role="assistant" />);
    const node = screen.getByTestId('gif');
    expect(node).toHaveAttribute('data-src', '/g.gif');
    expect(node).toHaveAttribute('data-alt', 'g');
    expect(node).toHaveAttribute('data-width', '120');
    expect(node).toHaveAttribute('data-height', '80');
  });

  it('renders chainLogo via ChainLogo', () => {
    const seg: MediaSegment = { type: 'chainLogo', chainName: 'Ethereum', size: 32 } as any;
    render(<RenderSegment segment={seg} role="assistant" />);
    const node = screen.getByTestId('chainLogo');
    expect(node).toHaveAttribute('data-name', 'Ethereum');
    expect(node).toHaveAttribute('data-size', '32');
  });

  it('renders music via MusicCommandRenderer', () => {
    const seg: MediaSegment = { type: 'music', song: 'song1', action: 'play' } as any;
    render(<RenderSegment segment={seg} role="assistant" />);
    const node = screen.getByTestId('music');
    expect(node).toHaveAttribute('data-action', 'play');
    expect(node).toHaveAttribute('data-song', 'song1');
  });

  it('renders goodbye with provided values', () => {
    const seg: MediaSegment = { type: 'goodbye', width: 200, height: 80, seconds: 3 } as any;
    render(<RenderSegment segment={seg} role="assistant" />);
    const node = screen.getByTestId('goodbye');
    expect(node).toHaveAttribute('data-w', '200');
    expect(node).toHaveAttribute('data-h', '80');
    expect(node).toHaveAttribute('data-s', '3');
  });

  it('renders goodbye with defaults when not provided', () => {
    const seg: MediaSegment = { type: 'goodbye' } as any;
    render(<RenderSegment segment={seg} role="assistant" />);
    const node = screen.getByTestId('goodbye');
    expect(node).toHaveAttribute('data-w', '420');
    expect(node).toHaveAttribute('data-h', '150');
    expect(node).toHaveAttribute('data-s', '10');
  });

  it('returns null for unknown segment type', () => {
    const seg = { type: 'unknown_any_thing' } as any as MediaSegment;
    const { container } = render(<RenderSegment segment={seg} role="assistant" />);
    expect(container).toBeEmptyDOMElement();
  });
});
