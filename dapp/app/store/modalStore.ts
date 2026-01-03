// dapp/app/store/modalStore.ts
import { create } from 'zustand';

export type ModalType = 'none' | 'mode' | 'error' | 'confirmReset' | 'battleForm';

export type ErrorPayload = {
  error: {
    message: string;
    details?: string;
    retry?: () => void;
  };
};

export type BattlePayload = {
  battleMode?: 'rapBattle' | 'agentBattle';
};

export type ModalMap = {
  none: undefined;
  mode: BattlePayload | undefined;
  error: ErrorPayload;
  confirmReset: undefined;
  battleForm: BattlePayload | undefined;
};

export type ModalState = {
  open: ModalType;
  // broad union of possible payloads (component-level narrowing still required)
  payload?: ModalMap[ModalType];
  // generic openModal: enforces payload matches the modal type
  openModal: <K extends ModalType>(type: K, payload?: ModalMap[K]) => void;
  closeModal: () => void;
};

export const useModalStore = create<ModalState>((set) => {
  const openModal = <K extends ModalType>(type: K, payload?: ModalMap[K]) =>
    set({ open: type, payload });

  const closeModal = () => set({ open: 'none', payload: undefined });

  return {
    open: 'none',
    payload: undefined,
    openModal,
    closeModal,
  };
});
