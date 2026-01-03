// dapp/app/api-docs/page.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'

// Capture props passed to SwaggerUI without loading the real lib
const receivedProps: any[] = []
vi.mock('swagger-ui-react', () => {
  return {
    default: (props: any) => {
      receivedProps.push(props)
      return <div data-testid="swagger-ui" data-url={props.url} />
    },
  }
})

// SUT (after mocks)
import ApiDocs from './page'

describe('ApiDocs page', () => {
  beforeEach(() => {
    receivedProps.length = 0
  })

  it('renders container and mounts SwaggerUI with the correct URL', () => {
    const { container } = render(<ApiDocs />)

    // container div
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeTruthy()
    expect(root.className).toContain('min-h-screen')

    // mocked SwaggerUI
    const stub = screen.getByTestId('swagger-ui')
    expect(stub).toBeInTheDocument()
    expect(stub.getAttribute('data-url')).toBe('/api/openapi')

    // also verify the prop captured via the mock
    expect(receivedProps).toHaveLength(1)
    expect(receivedProps[0]?.url).toBe('/api/openapi')
  })
})
