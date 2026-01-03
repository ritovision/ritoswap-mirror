// app/swap/page.unit.test.ts
import { swapPageMetadata } from './metadata'

describe('swapPageMetadata', () => {
  it('has all the required SEO fields', () => {
    expect(swapPageMetadata).toMatchObject({
      title:       expect.stringContaining('Trade'),
      description: expect.any(String),
      alternates:  { canonical: expect.stringMatching(/\/swap$/) },
      openGraph:   expect.objectContaining({
        url: expect.stringContaining('/swap'),
        images: expect.arrayContaining([
          expect.objectContaining({ url: expect.stringMatching(/^https?:\/\//) }),
        ]),
      }),
      twitter:     expect.objectContaining({ card: 'summary_large_image' }),
    })
  })
})
