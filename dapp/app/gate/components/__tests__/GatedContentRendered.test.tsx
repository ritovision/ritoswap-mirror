// app/gate/components/__tests__/GatedContentRenderer.test.tsx
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ✅ Mock AudioWrapper so media isn’t pulled in
vi.mock('@/components/utilities/media/audio/AudioWrapper', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="audio-wrapper" data-props={JSON.stringify(props)} />
  ),
}))

// ✅ Mock ChatBot so wagmi/react-query contexts aren’t required in unit tests
vi.mock('@/components/chatBot', () => ({
  __esModule: true,
  default: () => <div data-testid="chat-bot" />,
}))

// ✅ Import the component under test
import GatedContentRenderer from '../GatedContentRenderer/GatedContentRenderer'

// Minimal GatedContent payload
const makeContent = (): Parameters<typeof GatedContentRenderer>[0]['content'] => ({
  welcomeText: 'Welcome inside!',
  textSubmissionAreaHtml: `
    <div class="textSubmissionContainer">
      <h2 class="textSubmissionTitle">Submit Your Message</h2>
      <form id="gatedSubmissionForm" class="textSubmissionForm">
        <textarea id="gatedTextarea" class="textSubmissionTextarea" rows="3"></textarea>
        <button type="submit" id="gatedSubmitButton" class="textSubmissionButton">Sign & Submit</button>
      </form>
    </div>
  `,
  audioData: {
    headline: 'Secret Crypto Music',
    imageSrc: '/images/music/cover.jpg',
    imageAlt: 'cover',
    description: 'desc',
    title: 'title',
    audioSrc: '/audio/test.mp3',
    error: false,
  },
  styles: `.textSubmissionContainer { border: 1px solid red; }`,
  // Same behavior as server script: on submit, call window.handleGatedSubmission(text)
  script: `
    (function () {
      const form = document.getElementById('gatedSubmissionForm');
      const textarea = document.getElementById('gatedTextarea');
      const submitButton = document.getElementById('gatedSubmitButton');

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const text = textarea.value.trim();
        if (!text) return;

        submitButton.disabled = true;
        submitButton.classList.add('processing');
        submitButton.textContent = 'Sending...';

        try {
          window.handleGatedSubmission(text);
        } catch (err) {
          console.error(err);
        }
      });
    })();
  `,
})

describe('GatedContentRenderer', () => {
  beforeEach(() => {
    // ensure clean globals each run
    delete (window as any).__gate
    delete (window as any).__gatedEnvelope
    delete (window as any).handleGatedSubmission
    const style = document.getElementById('gated-content-styles')
    if (style) style.remove()
  })

  afterEach(() => {
    delete (window as any).__gate
    delete (window as any).__gatedEnvelope
    delete (window as any).handleGatedSubmission
    const style = document.getElementById('gated-content-styles')
    if (style) style.remove()
  })

  it('injects styles/content and exposes window helpers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<GatedContentRenderer content={makeContent()} onSubmit={onSubmit} />)

    // Content injected
    expect(screen.getByText('Welcome inside!')).toBeInTheDocument()
    expect(screen.getByText('Submit Your Message')).toBeInTheDocument()

    // Style tag injected
    await waitFor(() => {
      const style = document.getElementById('gated-content-styles')
      expect(style).toBeTruthy()
      expect(style!.textContent).toContain('.textSubmissionContainer')
    })

    // Audio wrapper rendered (mocked)
    expect(screen.getByTestId('audio-wrapper')).toBeInTheDocument()

    // window.__gate helpers available
    await waitFor(() => {
      expect((window as any).__gate).toBeTruthy()
      expect(typeof (window as any).__gate.buildEnvelope).toBe('function')
      expect(typeof (window as any).__gate.buildBoundMessage).toBe('function')
    })

    // Build an envelope and a message; ensure deterministic lines
    const env = (window as any).__gate.buildEnvelope()
    expect(env).toEqual(
      expect.objectContaining({
        domain: expect.any(String),
        path: '/api/form-submission-gate',
        method: 'POST',
        timestamp: expect.any(Number),
      })
    )
    const msg = (window as any).__gate.buildBoundMessage(123, 1, env.timestamp)
    expect(msg).toContain('I own key #123')
    expect(msg).toContain(`Domain: ${env.domain}`)
    expect(msg).toContain('Path: /api/form-submission-gate')
    expect(msg).toContain('Method: POST')
    expect(msg).toContain('ChainId: 1')
    expect(msg).toContain(`Timestamp: ${env.timestamp}`)
  })

  it('submits via embedded script and calls onSubmit with the message', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<GatedContentRenderer content={makeContent()} onSubmit={onSubmit} />)

    // Wait for script execution to attach handlers
    await waitFor(() => document.getElementById('gatedSubmissionForm'))
    const textarea = document.getElementById('gatedTextarea') as HTMLTextAreaElement
    const button = document.getElementById('gatedSubmitButton') as HTMLButtonElement

    await act(async () => {
      await user.type(textarea, 'hello world')
      await user.click(button)
    })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith('hello world')

    // A fresh envelope should be stashed
    expect((window as any).__gatedEnvelope).toEqual(
      expect.objectContaining({
        path: '/api/form-submission-gate',
        method: 'POST',
        timestamp: expect.any(Number),
      })
    )
  })

  it('shows audio error UI when audio error is flagged', () => {
    const content = makeContent()
    content.audioData.error = true

    const { getByText, queryByTestId } = render(
      <GatedContentRenderer content={content} onSubmit={vi.fn()} />
    )

    expect(getByText(/Audio Temporarily Unavailable/i)).toBeInTheDocument()
    expect(queryByTestId('audio-wrapper')).not.toBeInTheDocument()
  })
})
