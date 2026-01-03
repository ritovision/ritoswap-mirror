// app/lib/jsonld/loadJsonFromIndex.test.ts
import { loadJsonLdScripts } from './loadJsonFromIndex'

// Stub next/script to a raw 'script' tag so element.type === 'script'
vi.mock('next/script', () => ({
  __esModule: true,
  default: 'script',
}))

describe('loadJsonLdScripts', () => {
  it('generates <script> elements with correct props for each JSON-LD object', () => {
    const data = [{ name: 'Alice' }, { name: 'Bob', age: 30 }]
    const scripts = loadJsonLdScripts(data, 'jsonld')

    expect(scripts).toHaveLength(2)
    scripts.forEach((el, idx) => {
      // element type is 'script' (our mock)
      expect(el.type).toBe('script')
      // key prop
      expect(el.key).toBe(`jsonld-${idx}`)

      // inspect the props object
      const props = el.props as Record<string, any>
      expect(props.id).toBe(`jsonld-${idx}`)
      expect(props.type).toBe('application/ld+json')
      expect(props.strategy).toBe('beforeInteractive')
      expect(props.dangerouslySetInnerHTML.__html).toBe(
        JSON.stringify(data[idx])
      )
    })
  })
})
