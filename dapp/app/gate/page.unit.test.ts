// app/gate/page.unit.test.ts
import { gatePageMetadata } from './metadata'

describe('gatePageMetadata', () => {
  it('has all the required SEO fields', () => {
    expect(gatePageMetadata).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      alternates: {
        canonical: expect.stringMatching(/^https?:\/\//),
      },
      openGraph: expect.objectContaining({
        url: expect.stringContaining('/gate'),
        images: expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringMatching(/^https?:\/\//),
          }),
        ]),
      }),
      twitter: expect.objectContaining({
        card: 'summary_large_image',
      }),
    })
  })
})
