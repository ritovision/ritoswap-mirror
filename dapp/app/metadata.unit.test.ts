// app/metadata.unit.test.ts
import { metadata } from './metadata'

describe('root metadata', () => {
  it('follows the SEO/OG shape', () => {
    expect(metadata).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      alternates: { canonical: expect.stringMatching(/^https?:\/\//) },
      openGraph: expect.objectContaining({
        url: expect.stringContaining('https://'),
        images: expect.arrayContaining([
          expect.objectContaining({ url: expect.stringMatching(/^https?:\/\//) }),
        ]),
      }),
      twitter: expect.objectContaining({ card: 'summary_large_image' }),
    })
  })
})
