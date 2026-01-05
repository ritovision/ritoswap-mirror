// app/store/__mocks__/toolActivity.ts
import type { ToolActivityState, ToolStatus, ToolChip, ToolAnchor } from '../toolActivity';

/**
 * Create a fresh mock of the toolActivity store for each test.
 */
export function createMockToolActivityStore(): ToolActivityState {
  return {
    groups: {},
    activeGroupKey: undefined,
    uiToGroup: {},
    callToGroup: {},
    anchors: {},
    seq: 0,
    
    onSseStart: vi.fn(),
    onToolInputStart: vi.fn(),
    onToolInputAvailable: vi.fn(),
    onToolOutputAvailable: vi.fn(),
    onToolOutputPayload: vi.fn(),
    onToolOutputError: vi.fn(),
    onSseFinish: vi.fn(),
    attachActiveGroupToUiMessage: vi.fn(),
  };
}

let mockStoreState = createMockToolActivityStore();

export function resetMockToolActivityStore() {
  mockStoreState = createMockToolActivityStore();
}

export function getMockToolActivityStore() {
  return mockStoreState;
}

export const useToolActivityStore = {
  getState: vi.fn(() => mockStoreState),
  setState: vi.fn(),
  subscribe: vi.fn(),
  destroy: vi.fn(),
};

// Re-export types
export type { ToolActivityState, ToolStatus, ToolChip, ToolAnchor };