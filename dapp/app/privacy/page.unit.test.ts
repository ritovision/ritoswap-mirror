// app/privacy/page.unit.test.ts
import { privacyPageMetadata } from './metadata'

describe('privacyPageMetadata', () => {
  it('has all the required SEO fields', () => {
    expect(privacyPageMetadata).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      alternates: { canonical: expect.stringMatching(/^https?:\/\//) },
      openGraph: expect.objectContaining({
        url: expect.stringContaining('/privacy'),
        images: expect.arrayContaining([
          expect.objectContaining({ url: expect.stringMatching(/^https?:\/\//) }),
        ]),
      }),
      twitter: expect.objectContaining({ card: 'summary_large_image' }),
    })
  })
})
