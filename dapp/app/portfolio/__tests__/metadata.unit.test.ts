// app/portfolio/__tests__/metadata.unit.test.ts
import { portfolioPageMetadata } from '../metadata'
describe('portfolioPageMetadata', () => {
  it('has the required SEO fields', () => {
    expect(portfolioPageMetadata).toMatchObject({
      title:       expect.any(String),
      description: expect.any(String),
      alternates:  { canonical: expect.stringMatching(/\/portfolio$/) },
      openGraph:   expect.objectContaining({ url: expect.stringContaining('/portfolio') }),
      twitter:     expect.objectContaining({ card: 'summary_large_image' }),
    })
  })
})
