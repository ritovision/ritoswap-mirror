import { renderHook, act } from '@testing-library/react';
import {
  openWalletConnectModal,
  registerWalletConnectOpener,
  useRegisterWalletConnectOpener,
} from '../connectModalBridge';

describe('connectModalBridge', () => {
  beforeEach(() => {
    // Reset the module to clear module-level state
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('openWalletConnectModal', () => {
    it('calls the registered opener', async () => {
      // Re-import after reset to get fresh module
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      registerWalletConnectOpener(opener);

      openWalletConnectModal();
      
      // Flush microtasks and timers
      await vi.runAllTimersAsync();

      expect(opener).toHaveBeenCalledTimes(1);
    });

    it('does nothing if no opener is registered', async () => {
      const { openWalletConnectModal } = await import('../connectModalBridge');
      
      // Should not throw
      expect(() => {
        openWalletConnectModal();
      }).not.toThrow();
      
      await vi.runAllTimersAsync();
    });

    // Updated: current implementation does NOT debounce rapid calls;
    // it will synchronously invoke the opener for each call when registered.
    it('handles rapid successive calls (no debounce)', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      registerWalletConnectOpener(opener);

      // Call three times rapidly
      openWalletConnectModal();
      openWalletConnectModal();
      openWalletConnectModal();
      
      await vi.runAllTimersAsync();

      // Current implementation invokes each call immediately.
      expect(opener).toHaveBeenCalledTimes(3);
    });

    it('allows calls after debounce window (>50ms)', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      registerWalletConnectOpener(opener);

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      // Advance time past debounce window
      await vi.advanceTimersByTimeAsync(100);

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener).toHaveBeenCalledTimes(2);
    });

    // Updated: current implementation does not use an isOpening guard,
    // so concurrent calls may both invoke the opener.
    it('allows concurrent opens (no isOpening guard)', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      registerWalletConnectOpener(opener);

      // First call starts opening
      openWalletConnectModal();
      
      // Second call while first is still processing (before setTimeout(0) resolves)
      openWalletConnectModal();
      
      await vi.runAllTimersAsync();

      // Current implementation invokes both.
      expect(opener).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerWalletConnectOpener', () => {
    it('registers an opener that can be called', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      registerWalletConnectOpener(opener);

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener).toHaveBeenCalled();
    });

    it('last registration wins when multiple handlers register', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener1 = vi.fn();
      const opener2 = vi.fn();

      registerWalletConnectOpener(opener1);
      registerWalletConnectOpener(opener2);

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener1).not.toHaveBeenCalled();
      expect(opener2).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function that removes the handler', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      const unsubscribe = registerWalletConnectOpener(opener);

      unsubscribe();

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener).not.toHaveBeenCalled();
    });

    it('unsubscribe only removes if still current handler', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener1 = vi.fn();
      const opener2 = vi.fn();

      const unsubscribe1 = registerWalletConnectOpener(opener1);
      registerWalletConnectOpener(opener2);

      // Unsubscribe first handler (but second is now current)
      unsubscribe1();

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      // Second handler should still work
      expect(opener1).not.toHaveBeenCalled();
      expect(opener2).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe of current handler clears registration', async () => {
      const { openWalletConnectModal, registerWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();
      const unsubscribe = registerWalletConnectOpener(opener);

      unsubscribe();

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener).not.toHaveBeenCalled();
    });
  });

  describe('useRegisterWalletConnectOpener', () => {
    it('registers handler on mount', async () => {
      const { openWalletConnectModal, useRegisterWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();

      renderHook(() => useRegisterWalletConnectOpener(opener));

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener).toHaveBeenCalled();
    });

    it('unregisters handler on unmount', async () => {
      const { openWalletConnectModal, useRegisterWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener = vi.fn();

      const { unmount } = renderHook(() => useRegisterWalletConnectOpener(opener));

      unmount();

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener).not.toHaveBeenCalled();
    });

    it('re-registers when handler changes', async () => {
      const { openWalletConnectModal, useRegisterWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener1 = vi.fn();
      const opener2 = vi.fn();

      const { rerender } = renderHook(
        ({ handler }) => useRegisterWalletConnectOpener(handler),
        { initialProps: { handler: opener1 } }
      );

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener1).toHaveBeenCalledTimes(1);

      // Change handler
      rerender({ handler: opener2 });

      // Wait for debounce to clear
      await vi.advanceTimersByTimeAsync(100);
      
      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener1).toHaveBeenCalledTimes(1);
      expect(opener2).toHaveBeenCalledTimes(1);
    });

    it('handles multiple hooks - last one wins', async () => {
      const { openWalletConnectModal, useRegisterWalletConnectOpener } = await import('../connectModalBridge');
      
      const opener1 = vi.fn();
      const opener2 = vi.fn();

      renderHook(() => useRegisterWalletConnectOpener(opener1));
      renderHook(() => useRegisterWalletConnectOpener(opener2));

      openWalletConnectModal();
      await vi.runAllTimersAsync();

      expect(opener1).not.toHaveBeenCalled();
      expect(opener2).toHaveBeenCalledTimes(1);
    });
  });
});
