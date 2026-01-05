// components/footer/__tests__/FooterSocialsClient.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import FooterSocialsClient from '../utilities/footerSocials/FooterSocialsClient'

describe('<FooterSocialsClient />', () => {
  it('renders all social links with correct href, aria-label, and image src', () => {
    render(<FooterSocialsClient />)

    const socials = [
      {
        ariaLabel: "Visit Rito's LinkedIn profile (opens in new tab)",
        href: "https://www.linkedin.com/in/rito-matt-j-pellerito-36779084/",
        srcFragment: "linkedin-white.png",
      },
      {
        ariaLabel: "Visit Rito's Twitter profile (opens in new tab)",
        href: "https://x.com/rito_rhymes",
        srcFragment: "twitter-white.png",
      },
      {
        ariaLabel: "Visit Rito's Instagram profile (opens in new tab)",
        href: "https://instagram.com/ritorhymes",
        srcFragment: "instagram-white.png",
      },
      {
        ariaLabel: "Visit Rito's GitHub profile (opens in new tab)",
        href: "https://github.com/ritorhymes",
        srcFragment: "github-white.png",
      },
    ]

    socials.forEach(({ ariaLabel, href, srcFragment }) => {
      // find the link by its aria-label
      const link = screen.getByRole('link', { name: ariaLabel })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')

      // inside the link, there should be an <img> whose src contains our fragment
      const img = link.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', expect.stringContaining(srcFragment))
    })
  })

  it('displays "Socials" text with the correct aria-label', () => {
    render(<FooterSocialsClient />)

    const socialsText = screen.getByText('Socials')
    expect(socialsText).toBeInTheDocument()
    expect(socialsText).toHaveAttribute('aria-label', 'Social media section')
  })
})
