import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Prompt {
  id: string;
  name: string;
  text: string;
}

interface PromptStore {
  prompts: Prompt[];
  activePromptId: string;
  addPrompt: (prompt: Omit<Prompt, 'id'>) => void;
  updatePrompt: (id: string, prompt: Omit<Prompt, 'id'>) => void;
  deletePrompt: (id: string) => void;
  deleteAll: () => void;
  setActivePrompt: (id: string) => void;
  getActivePrompt: () => Prompt | undefined;
}

const defaultPrompt: Prompt = {
  id: 'default',
  name: 'Default',
  text: 'Please explain this webpage to me',
};

export const usePromptStore = create<PromptStore>()(
  persist(
    (set, get) => ({
      prompts: [defaultPrompt],
      activePromptId: 'default',

      addPrompt: (prompt) => {
        const id = Date.now().toString();
        set((state) => ({
          prompts: [...state.prompts, { ...prompt, id }],
        }));
      },

      updatePrompt: (id, prompt) => {
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.id === id ? { ...prompt, id } : p
          ),
        }));
      },

      deletePrompt: (id) => {
        set((state) => {
          const newPrompts = state.prompts.filter((p) => p.id !== id);
          // If deleting active prompt, reset to first available or empty string
          const newActiveId = state.activePromptId === id
            ? (newPrompts[0]?.id || '')
            : state.activePromptId;

          return {
            prompts: newPrompts,
            activePromptId: newActiveId,
          };
        });
      },

      deleteAll: () => {
        set({
          prompts: [],
          activePromptId: '',
        });
      },

      setActivePrompt: (id) => {
        set({ activePromptId: id });
      },

      getActivePrompt: () => {
        const state = get();
        return state.prompts.find((p) => p.id === state.activePromptId);
      },
    }),
    {
      name: 'ai-prompts',
    }
  )
);
