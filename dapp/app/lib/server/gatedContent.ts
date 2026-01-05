// lib/server/gatedContent.ts
import { generateSignedAudioUrl } from './r2'
import type { GatedContent } from '@schemas/dto/gate-access.dto'

/**
 * Generate gated content payload.
 * 
 * Aligns the return type to the GatedContent DTO so TS enforces schema compatibility.
 */
export async function getGatedContent(): Promise<GatedContent> {
  let audioUrl = ''
  let audioError = false

  try {
    audioUrl = await generateSignedAudioUrl()
  } catch (error) {
    console.error('Failed to generate signed audio URL:', error)
    audioError = true
  }

  return {
    welcomeText:
      "Welcome inside. You get to send one message with your unused key and can listen to Rito's top secret song featuring Britney Spears backup singer parodying her own song, but after you send one message, you're out. Enjoy it while it lasts!",

    textSubmissionAreaHtml: `
      <div class="textSubmissionContainer">
        <h2 class="textSubmissionTitle">Submit Your Message</h2>
        <form id="gatedSubmissionForm" class="textSubmissionForm">
          <textarea
            id="gatedTextarea"
            class="textSubmissionTextarea"
            placeholder="Enter your message here..."
            rows="6"
          ></textarea>
          <button
            type="submit"
            id="gatedSubmitButton"
            class="textSubmissionButton"
          >
            Sign & Submit
          </button>
        </form>
      </div>
    `,

    audioData: {
      headline: 'Secret Crypto Music',
      imageSrc: '/images/music/hitmebitcoin-coverart-square.jpg',
      imageAlt: 'Cover art of Britney Spears crying about Bitcoin price crashing',
      description: 'Number go up, number go down, will it ever end?',
      title: 'Hit Me Bitcoin One More Time',
      audioSrc: audioUrl,
      error: audioError,
    },

    styles: `
      .textSubmissionContainer {
        width: 100%;
        max-width: 600px;
        padding: 2rem;
        background: rgba(0, 30, 60, 0.8);
        border: var(--default-border);
        border-radius: 10px;
        box-shadow: 
          0 0 20px rgba(0, 123, 255, 0.3),
          0 0 40px rgba(0, 123, 255, 0.2),
          0 0 60px rgba(0, 123, 255, 0.1),
          inset 0 0 20px rgba(0, 123, 255, 0.1);
        animation: glowPulse 3s ease-in-out infinite;
      }
      
      .textSubmissionTitle {
        font-family: var(--font-primary);
        font-size: 2rem;
        color: white;
        text-align: center;
        margin: 0 0 2rem 0;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      
      .textSubmissionForm {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      
      .textSubmissionTextarea {
        width: 100%;
        min-height: 150px;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(0, 123, 255, 0.3);
        border-radius: 5px;
        color: white;
        font-family: inherit;
        font-size: 1rem;
        resize: vertical;
        transition: all 0.3s ease;
        outline: none;
      }
      
      .textSubmissionTextarea:focus {
        border-color: var(--secondary-color);
        box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
      }
      
      .textSubmissionButton {
        padding: 1rem 2rem;
        font-family: var(--font-primary);
        font-size: 1.2rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        background: transparent;
        border: var(--default-border);
        border-radius: 200px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        align-self: center;
      }
      
      .textSubmissionButton:hover:not(:disabled) {
        background: var(--secondary-color);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
      }
      
      .textSubmissionButton.processing {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      @keyframes glowPulse {
        0%, 100% {
          box-shadow: 
            0 0 20px rgba(0, 123, 255, 0.3),
            0 0 40px rgba(0, 123, 255, 0.2),
            0 0 60px rgba(0, 123, 255, 0.1),
            inset 0 0 20px rgba(0, 123, 255, 0.1);
        }
        50% {
          box-shadow: 
            0 0 25px rgba(0, 123, 255, 0.4),
            0 0 50px rgba(0, 123, 255, 0.3),
            0 0 75px rgba(0, 123, 255, 0.2),
            inset 0 0 25px rgba(0, 123, 255, 0.15);
        }
      }
    `,

    script: `
      (function() {
        const form = document.getElementById('gatedSubmissionForm');
        const textarea = document.getElementById('gatedTextarea');
        const submitButton = document.getElementById('gatedSubmitButton');
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const text = textarea.value.trim();
          if (!text) {
            alert('Please enter some text');
            return;
          }
          
          submitButton.disabled = true;
          submitButton.textContent = 'Sending...';
          submitButton.classList.add('processing');
          
          try {
            window.handleGatedSubmission(text);
          } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to submit. Please try again.');
            submitButton.disabled = false;
            submitButton.textContent = 'Sign & Submit';
            submitButton.classList.remove('processing');
          }
        });
      })();
    `,
  }
}
