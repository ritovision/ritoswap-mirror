import { useToolActivityStore, type ToolChip, type ToolStatus } from '../toolActivity'

const resetStore = () => {
  useToolActivityStore.setState({
    groups: {},
    activeGroupKey: undefined,
    uiToGroup: {},
    callToGroup: {},
    anchors: {},
    seq: 0,
  })
}

const get = () => useToolActivityStore.getState()

describe('toolActivity store', () => {
  beforeEach(() => resetStore())

  it('starts with the correct initial state', () => {
    const s = get()
    expect(s.groups).toEqual({})
    expect(s.activeGroupKey).toBeUndefined()
    expect(s.uiToGroup).toEqual({})
    expect(s.callToGroup).toEqual({})
    expect(s.anchors).toEqual({})
    expect(s.seq).toBe(0)
  })

  it('onSseStart without id creates a seq group and increments seq', () => {
    get().onSseStart()
    let s = get()
    expect(s.seq).toBe(1)
    expect(s.activeGroupKey).toBe('seq-1')
    expect(s.groups['seq-1']).toBeDefined()
    expect(typeof s.groups['seq-1'].createdAt).toBe('number')

    get().onSseStart()
    s = get()
    expect(s.seq).toBe(2)
    expect(s.activeGroupKey).toBe('seq-2')
    expect(s.groups['seq-2']).toBeDefined()
  })

  it('onSseStart with messageId creates/activates that group and increments seq', () => {
    get().onSseStart('m1')
    const s = get()
    expect(s.seq).toBe(1)
    expect(s.activeGroupKey).toBe('m1')
    expect(s.groups['m1']).toBeDefined()
  })

  it('onToolInputStart creates a pending chip and callToGroup mapping', () => {
    // No active group yet -> should default to seq-1
    get().onToolInputStart('call-1', 'fetch')
    const s = get()
    expect(s.activeGroupKey).toBe('seq-1')
    expect(s.seq).toBe(0) // seq is not bumped by onToolInputStart itself
    const g = s.groups['seq-1']
    expect(g).toBeDefined()
    expect(g.chips['call-1']).toMatchObject({
      toolCallId: 'call-1',
      toolName: 'fetch',
      status: 'pending',
    })
    expect(typeof g.chips['call-1'].createdAt).toBe('number')
    expect(s.callToGroup['call-1']).toBe('seq-1')

    // Calling again with the same call id is a no-op (chip already exists)
    const beforeGroupsRef = s.groups
    get().onToolInputStart('call-1', 'fetch-again')
    expect(get().groups).toBe(beforeGroupsRef) // unchanged reference indicates no set
  })

  it('onToolInputAvailable creates or merges a chip and sets active group', () => {
    // Make a group active first
    get().onSseStart('m2')
    get().onToolInputAvailable('call-2', 'imgGen', { prompt: 'cat' })
    let s = get()
    expect(s.activeGroupKey).toBe('m2')
    let chip = s.groups['m2'].chips['call-2']
    expect(chip).toMatchObject({
      toolCallId: 'call-2',
      toolName: 'imgGen',
      status: 'pending',
      input: { prompt: 'cat' },
    })
    expect(s.callToGroup['call-2']).toBe('m2')

    // If chip exists, merges new input and preserves toolName if already set
    get().onToolInputStart('call-3', 'downloader')
    const key = get().activeGroupKey!
    get().onToolInputAvailable('call-3', 'newNameShouldNotOverride', { url: 'http://x' })
    s = get()
    chip = s.groups[key].chips['call-3']
    expect(chip.toolName).toBe('downloader') // existing name wins
    expect(chip.input).toEqual({ url: 'http://x' })
  })

  it('onToolOutputAvailable marks success and records errors without downgrading', () => {
    // Prepare a chip
    get().onSseStart('m3')
    get().onToolInputStart('call-4', 'proc')

    // success
    get().onToolOutputAvailable('call-4')
    let s = get()
    expect(s.groups['m3'].chips['call-4'].status).toBe<'success'>('success')

    // mark error -> becomes error with text
    get().onToolOutputAvailable('call-4', { isError: true, errorText: 'boom' })
    s = get()
    expect(s.groups['m3'].chips['call-4']).toMatchObject({
      status: 'error',
      errorText: 'boom',
    })

    // try to "succeed" after error -> stays error
    get().onToolOutputAvailable('call-4')
    s = get()
    expect(s.groups['m3'].chips['call-4'].status).toBe<'error'>('error')
  })

  it('onToolOutputPayload stores output payload', () => {
    get().onSseStart('m4')
    get().onToolInputStart('call-5', 'proc')
    get().onToolOutputPayload('call-5', { foo: 1 })
    const s = get()
    expect(s.groups['m4'].chips['call-5'].output).toEqual({ foo: 1 })
  })

  it('onToolOutputError sets error (idempotent for same error text)', () => {
    get().onSseStart('m5')
    get().onToolInputStart('call-6', 'proc')

    get().onToolOutputError('call-6', 'bad news')
    let s = get()
    expect(s.groups['m5'].chips['call-6']).toMatchObject({
      status: 'error',
      errorText: 'bad news',
    })

    // Calling again with same error should be a no-op (state reference unchanged)
    const before = get().groups
    get().onToolOutputError('call-6', 'bad news')
    expect(get().groups).toBe(before)
  })

  it('onSseFinish clears activeGroupKey', () => {
    get().onSseStart('m6')
    expect(get().activeGroupKey).toBe('m6')
    get().onSseFinish()
    expect(get().activeGroupKey).toBeUndefined()
  })

  it('attachActiveGroupToUiMessage attaches group and records anchor only once', () => {
    get().onSseStart('m7')
    const s1Before = get()

    // first attach with anchor
    get().attachActiveGroupToUiMessage('ui-1', { partIndex: 2, charOffset: 10 })
    let s = get()
    expect(s.uiToGroup['ui-1']).toBe('m7')
    expect(s.anchors['ui-1']).toEqual({ partIndex: 2, charOffset: 10 })
    expect(s.groups['m7'].attachedUiMessageId).toBe('ui-1')

    // second attach (same ui id, already anchored) should be a no-op
    const stateRefBefore = get()
    get().attachActiveGroupToUiMessage('ui-1', { partIndex: 99, charOffset: 99 })
    const stateRefAfter = get()
    expect(stateRefAfter).toBe(stateRefBefore) // no set performed
    // anchor unchanged
    expect(stateRefAfter.anchors['ui-1']).toEqual({ partIndex: 2, charOffset: 10 })

    // also test attaching without anchor when already mapped -> no change
    get().attachActiveGroupToUiMessage('ui-1')
    expect(get()).toBe(stateRefAfter)
  })

  it('gracefully no-ops when attaching without an active group', () => {
    // no active group in initial state
    const before = get()
    get().attachActiveGroupToUiMessage('ui-x', { partIndex: 0, charOffset: 0 })
    expect(get()).toBe(before)
  })
})
