// → app/terms/page.unit.test.ts
import { termsPageMetadata } from './metadata'

describe('termsPageMetadata', () => {
  it('has all the required SEO fields', () => {
    expect(termsPageMetadata).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      alternates: { canonical: expect.stringMatching(/^https?:\/\//) },
      openGraph: expect.objectContaining({
        url: expect.stringContaining('/terms'),
        images: expect.arrayContaining([
          expect.objectContaining({ url: expect.stringMatching(/^https?:\/\//) }),
        ]),
      }),
      twitter: expect.objectContaining({ card: 'summary_large_image' }),
    })
  })
})
