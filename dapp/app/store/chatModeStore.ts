// dapp/app/store/chatModeStore.ts
import { create } from 'zustand';
import { ChatMode } from '@lib/llm/modes/types';
import { BattleFormData, defaultFormData } from '@/components/chatBot/forms/battleFormSchema';

interface ChatModeState {
  activeMode: ChatMode | null;
  origin: 'prop' | 'user' | null;
  lockedByProp: boolean;
  battleFormData: BattleFormData;
  
  setMode: (mode: ChatMode, origin: 'prop' | 'user') => void;
  resetMode: () => void;
  updateUserField: (field: keyof BattleFormData['user'], value: string) => void;
  updateChatbotField: (field: keyof BattleFormData['chatbot'], value: string) => void;
  clearBattleForm: () => void;
}

export const useChatModeStore = create<ChatModeState>((set) => ({
  activeMode: null,
  origin: null,
  lockedByProp: false,
  battleFormData: defaultFormData,
  
  setMode: (mode, origin) => {
    set({
      activeMode: mode,
      origin,
      lockedByProp: origin === 'prop',
    });
  },
  
  resetMode: () => {
    set((state) => {
      if (state.lockedByProp) {
        return state;
      }
      return {
        activeMode: null,
        origin: null,
        lockedByProp: false,
      };
    });
  },
  
  updateUserField: (field, value) => {
    set((state) => ({
      battleFormData: {
        ...state.battleFormData,
        user: {
          ...state.battleFormData.user,
          [field]: value,
        },
      },
    }));
  },
  
  updateChatbotField: (field, value) => {
    set((state) => ({
      battleFormData: {
        ...state.battleFormData,
        chatbot: {
          ...state.battleFormData.chatbot,
          [field]: value,
        },
      },
    }));
  },
  
  clearBattleForm: () => {
    set({ battleFormData: defaultFormData });
  },
}));