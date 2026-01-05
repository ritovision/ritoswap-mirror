// dapp/app/store/__tests__/toolImageStore.test.ts
import {
  useLocalImageStore,
  isStoreImageUri,
  nameFromStoreUri,
} from '../toolImageStore'

const resetStore = () => {
  useLocalImageStore.setState({ images: {} })
}

const sample = (overrides: Partial<ReturnType<typeof makeSample>> = {}) => {
  return { ...makeSample(), ...overrides }
}
const makeSample = () => ({
  name: 'cat.png',
  mime: 'image/png',
  width: 640,
  height: 480,
  alt: 'a cat',
  dataBase64: 'iVBORw0KGgoAAAANSUhEUg==',
})

describe('useLocalImageStore', () => {
  beforeEach(() => resetStore())

  it('starts empty', () => {
    const { images } = useLocalImageStore.getState()
    expect(images).toEqual({})
  })

  it('putFromBase64 stores image with correct dataUrl', () => {
    const p = makeSample()
    useLocalImageStore.getState().putFromBase64(p)

    const { images } = useLocalImageStore.getState()
    const img = images[p.name]
    expect(img).toBeDefined()
    expect(img).toMatchObject({
      name: p.name,
      mime: p.mime,
      width: p.width,
      height: p.height,
      alt: p.alt,
    })
    expect(img!.dataUrl).toBe(`data:${p.mime};base64,${p.dataBase64}`)
  })

  it('has / get / getUrl reflect presence and retrieval', () => {
    const { has, get, getUrl, putFromBase64 } = useLocalImageStore.getState()
    const p = makeSample()

    expect(has(p.name)).toBe(false)
    expect(get(p.name)).toBeUndefined()
    expect(getUrl(p.name)).toBeUndefined()

    putFromBase64(p)

    expect(has(p.name)).toBe(true)
    const img = get(p.name)
    expect(img?.name).toBe(p.name)
    expect(getUrl(p.name)).toBe(`data:${p.mime};base64,${p.dataBase64}`)
  })

  it('putFromBase64 is additive and can overwrite same key', () => {
    const { putFromBase64, get } = useLocalImageStore.getState()
    const p1 = makeSample()
    const p2 = sample({
      dataBase64: 'AAAABBBBCCCC',
      width: 100,
      height: 200,
    })

    putFromBase64(p1)
    const first = get(p1.name)
    putFromBase64({ ...p1, ...p2 }) // same name; overwrites

    const second = useLocalImageStore.getState().get(p1.name)

    // different object reference (immutability)
    expect(second).not.toBe(first)

    // updated values persisted
    expect(second?.width).toBe(100)
    expect(second?.height).toBe(200)
    expect(second?.dataUrl).toBe(`data:${p1.mime};base64,AAAABBBBCCCC`)
  })

  it('clear wipes all images', () => {
    const { putFromBase64, clear } = useLocalImageStore.getState()
    putFromBase64(makeSample())
    putFromBase64(sample({ name: 'dog.jpg', mime: 'image/jpeg' }))

    clear()

    const { images } = useLocalImageStore.getState()
    expect(images).toEqual({})
  })

  it('handles multiple entries independently', () => {
    const { putFromBase64, get } = useLocalImageStore.getState()
    const a = makeSample()
    const b = sample({ name: 'dog.jpg', mime: 'image/jpeg', dataBase64: 'DOGBASE64' })

    putFromBase64(a)
    putFromBase64(b)

    const ia = get(a.name)!
    const ib = get(b.name)!
    expect(ia.dataUrl).toBe(`data:${a.mime};base64,${a.dataBase64}`)
    expect(ib.dataUrl).toBe(`data:${b.mime};base64,DOGBASE64`)

    // ensure no accidental cross-talk
    expect(ia.mime).toBe('image/png')
    expect(ib.mime).toBe('image/jpeg')
  })
})

describe('URI helpers', () => {
  it('isStoreImageUri detects prefixed URIs', () => {
    expect(isStoreImageUri('store://image/cat.png')).toBe(true)
    expect(isStoreImageUri('store://image/dog.jpg')).toBe(true)
    expect(isStoreImageUri('http://example.com')).toBe(false)
    expect(isStoreImageUri(undefined)).toBe(false)
  })

  it('nameFromStoreUri extracts and decodes names', () => {
    expect(nameFromStoreUri('store://image/cat.png')).toBe('cat.png')
    expect(nameFromStoreUri('store://image/dog%20photo.jpg')).toBe('dog photo.jpg')
    expect(nameFromStoreUri('store://image/%F0%9F%90%B1-kitty.png')).toBe('🐱-kitty.png')
  })
})