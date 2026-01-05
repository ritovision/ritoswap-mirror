// components/utilities/media/audio/AudioWrapper.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import AudioWrapper from './AudioWrapper'

// Mock CustomAudioPlayer
vi.mock('./CustomAudioPlayer', () => ({
  __esModule: true,
  default: ({ title, audioSrc }: any) => (
    <div data-testid="custom-audio-player">
      {title} - {audioSrc}
    </div>
  )
}))

// Mock IntersectionObserver
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: mockObserve,
  disconnect: mockDisconnect
}))

describe('<AudioWrapper />', () => {
  const defaultProps = {
    headline: 'Test Headline',
    imageSrc: '/test.jpg',
    imageAlt: 'Test image',
    description: 'Test description',
    title: 'Audio Title',
    audioSrc: '/audio.mp3'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all content', () => {
    render(<AudioWrapper {...defaultProps} />)
    
    expect(screen.getByText('Test Headline')).toBeInTheDocument()
    expect(screen.getByAltText('Test image')).toHaveAttribute('src', '/test.jpg')
    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByTestId('custom-audio-player')).toHaveTextContent('Audio Title - /audio.mp3')
  })

  it('sets up intersection observer', () => {
    render(<AudioWrapper {...defaultProps} />)
    
    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      { threshold: 0.4 }
    )
    expect(mockObserve).toHaveBeenCalled()
  })

  it('adds visible class when intersecting', async () => {
    const { container } = render(<AudioWrapper {...defaultProps} />)
    const wrapper = container.querySelector('section')
    
    expect(wrapper!.className).not.toMatch(/visible/)
    
    // Trigger intersection
    const [[callback]] = (global.IntersectionObserver as any).mock.calls
    callback([{ isIntersecting: true }])
    
    await waitFor(() => {
      expect(wrapper!.className).toMatch(/visible/)
    })
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('accepts ReactNode as description', () => {
    const customDescription = <span data-testid="custom">Custom <strong>content</strong></span>
    render(<AudioWrapper {...defaultProps} description={customDescription} />)
    
    expect(screen.getByTestId('custom')).toBeInTheDocument()
  })
})