import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { usePromptStore } from '@/app/stores/promptStore'

const basePrompt = { ...usePromptStore.getState().prompts[0] }

describe('promptStore', () => {
  beforeEach(() => {
    act(() => {
      usePromptStore.setState({
        prompts: [{ ...basePrompt }],
        activePromptId: basePrompt.id
      })
    })

    if (usePromptStore.persist?.clearStorage) {
      usePromptStore.persist.clearStorage()
    }
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds a prompt with a generated id', () => {
    const addPrompt = usePromptStore.getState().addPrompt
    vi.spyOn(Date, 'now').mockReturnValue(1712345678900)

    act(() => {
      addPrompt({ name: 'Summary', text: 'Summarize the page' })
    })

    const state = usePromptStore.getState()
    expect(state.prompts).toHaveLength(2)
    expect(state.prompts[1]).toMatchObject({
      id: '1712345678900',
      name: 'Summary',
      text: 'Summarize the page'
    })
  })

  it('updates an existing prompt in place', () => {
    const updatePrompt = usePromptStore.getState().updatePrompt

    act(() => {
      updatePrompt(basePrompt.id, { name: 'Default Updated', text: 'New default prompt' })
    })

    const updated = usePromptStore.getState().prompts[0]
    expect(updated).toStrictEqual({
      id: basePrompt.id,
      name: 'Default Updated',
      text: 'New default prompt'
    })
  })

  it('deletes a prompt and keeps active id in sync', () => {
    const { addPrompt, deletePrompt, setActivePrompt } = usePromptStore.getState()

    vi.spyOn(Date, 'now').mockReturnValueOnce(1001).mockReturnValueOnce(1002)

    act(() => {
      addPrompt({ name: 'A', text: 'A' })
      addPrompt({ name: 'B', text: 'B' })
    })

    const secondId = usePromptStore.getState().prompts[1].id

    act(() => {
      setActivePrompt(secondId)
    })

    act(() => {
      deletePrompt(secondId)
    })

    const state = usePromptStore.getState()
    expect(state.prompts.map((p) => p.id)).not.toContain(secondId)
    expect(state.activePromptId).toBe(basePrompt.id)
  })

  it('clears all prompts', () => {
    const deleteAll = usePromptStore.getState().deleteAll

    act(() => {
      deleteAll()
    })

    const state = usePromptStore.getState()
    expect(state.prompts).toEqual([])
    expect(state.activePromptId).toBe('')
  })

  it('returns the active prompt helper', () => {
    const { addPrompt, setActivePrompt, getActivePrompt } = usePromptStore.getState()

    vi.spyOn(Date, 'now').mockReturnValue(555)

    act(() => {
      addPrompt({ name: 'Deep Dive', text: 'Explain details' })
    })

    act(() => {
      setActivePrompt('555')
    })

    expect(getActivePrompt()).toMatchObject({
      id: '555',
      name: 'Deep Dive',
      text: 'Explain details'
    })
  })
})
