import React from 'react'

const config = {
  logo: <span>RitoSwap Documentation</span>,
  project: {
    link: 'https://github.com/yourusername/yourrepo',
  },
  chat: {
    link: 'https://discord.com',
  },
  docsRepositoryBase: 'https://github.com/yourusername/yourrepo/tree/main/docs',
  footer: {
    text: 'RitoSwap © 2025',
  },
  // Customize these as needed
  primaryHue: 210,
  primarySaturation: 100,
  navigation: true,
  sidebar: {
    toggleButton: true,
    defaultMenuCollapseLevel: 1,
    defaultOpen: true,
    autoCollapse: true,
  },
  toc: {
    float: true,
    title: 'On This Page',
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  banner: {
    key: 'release-banner',
    text: (
      <a href="/changelog" target="_blank">
        New features released. Read more →
      </a>
    )
  }
}

export default config