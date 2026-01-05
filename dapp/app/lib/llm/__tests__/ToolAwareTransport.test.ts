// app/lib/llm/__tests__/ToolAwareTransport.test.ts
import { createToolAwareTransport } from '../client/ToolAwareTransport';
import { 
  resetMockToolActivityStore, 
  getMockToolActivityStore 
} from '@store/__mocks__/toolActivity';

// Mock the store module
vi.mock('@store/toolActivity', async () => {
  const mock = await import('@store/__mocks__/toolActivity');
  return { useToolActivityStore: mock.useToolActivityStore };
});

describe('ToolAwareTransport', () => {
  const mockApi = '/api/chat';
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
    resetMockToolActivityStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createToolAwareTransport', () => {
    it('creates transport with basic config', () => {
      const transport = createToolAwareTransport({
        api: mockApi,
      });

      expect(transport).toBeDefined();
    });

    it('creates transport with headers', () => {
      const transport = createToolAwareTransport({
        api: mockApi,
        headers: { 'X-Custom': 'test' },
      });

      expect(transport).toBeDefined();
    });
  });

  describe('Metadata Injection', () => {
    it('injects metadata into POST requests', async () => {
      const metadata = { mode: 'swap', userId: '123' };
      const getMetadata = vi.fn(() => metadata);
      
      const transport = createToolAwareTransport({
        api: mockApi,
        getMetadata,
      });

      const originalBody = { messages: [{ role: 'user', content: 'test' }] };
      
      mockFetch.mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );

      const customFetch = (transport as any).fetch;
      await customFetch(mockApi, {
        method: 'POST',
        body: JSON.stringify(originalBody),
      });

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1].body);

      expect(sentBody.metadata).toEqual(metadata);
      expect(sentBody.messages).toEqual(originalBody.messages);
    });

    it('merges metadata with existing metadata', async () => {
      const newMetadata = { mode: 'swap' };
      const getMetadata = vi.fn(() => newMetadata);
      
      const transport = createToolAwareTransport({
        api: mockApi,
        getMetadata,
      });

      const originalBody = {
        messages: [{ role: 'user', content: 'test' }],
        metadata: { existingKey: 'value' },
      };
      
      mockFetch.mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );

      const customFetch = (transport as any).fetch;
      await customFetch(mockApi, {
        method: 'POST',
        body: JSON.stringify(originalBody),
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.metadata).toEqual({
        existingKey: 'value',
        mode: 'swap',
      });
    });

    it('handles metadata injection errors gracefully', async () => {
      const getMetadata = vi.fn(() => ({ mode: 'swap' }));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const transport = createToolAwareTransport({
        api: mockApi,
        getMetadata,
      });

      mockFetch.mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );

      const customFetch = (transport as any).fetch;
      await customFetch(mockApi, {
        method: 'POST',
        body: 'invalid-json',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to inject metadata into request:',
        expect.any(Error)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        mockApi,
        expect.objectContaining({ body: 'invalid-json' })
      );

      consoleSpy.mockRestore();
    });

    it('does not inject metadata for non-POST requests', async () => {
      const getMetadata = vi.fn(() => ({ mode: 'swap' }));
      
      const transport = createToolAwareTransport({
        api: mockApi,
        getMetadata,
      });

      mockFetch.mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );

      const customFetch = (transport as any).fetch;
      await customFetch(mockApi, {
        method: 'GET',
      });

      expect(getMetadata).not.toHaveBeenCalled();
    });
  });

  describe('SSE Stream Parsing', () => {
    function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let index = 0;

      return new ReadableStream({
        pull(controller) {
          if (index < events.length) {
            controller.enqueue(encoder.encode(events[index] + '\n\n'));
            index++;
          } else {
            controller.close();
          }
        },
      });
    }

    it('parses start event', async () => {
      const stream = createSSEStream([
        'data: {"type":"start","messageId":"msg-123"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onSseStart).toHaveBeenCalledWith('msg-123');
    });

    it('parses error event and forwards to callback', async () => {
      const stream = createSSEStream([
        'data: {"type":"error","errorText":"Timed out"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const onSseError = vi.fn();
      const transport = createToolAwareTransport({ api: mockApi, onSseError });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onSseError).toHaveBeenCalledWith('Timed out');
    });

    it('parses tool-input-start event', async () => {
      const stream = createSSEStream([
        'data: {"type":"tool-input-start","toolCallId":"call-1","toolName":"web_search"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolInputStart).toHaveBeenCalledWith('call-1', 'web_search');
    });

    it('parses tool-input-available event', async () => {
      const input = { query: 'test search' };
      const stream = createSSEStream([
        `data: {"type":"tool-input-available","toolCallId":"call-1","toolName":"web_search","input":${JSON.stringify(input)}}`,
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolInputAvailable).toHaveBeenCalledWith(
        'call-1',
        'web_search',
        input
      );
    });

    it('parses successful tool-output-available event', async () => {
      const output = { result: 'success' };
      const stream = createSSEStream([
        `data: {"type":"tool-output-available","toolCallId":"call-1","output":${JSON.stringify(output)}}`,
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolOutputPayload).toHaveBeenCalledWith('call-1', output);
      expect(mockStore.onToolOutputAvailable).toHaveBeenCalledWith('call-1', { isError: false });
    });

    it('parses error tool-output-available event with top-level isError', async () => {
      const stream = createSSEStream([
        'data: {"type":"tool-output-available","toolCallId":"call-1","isError":true,"output":{"errorText":"Failed"}}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolOutputAvailable).toHaveBeenCalledWith('call-1', {
        isError: true,
        errorText: 'Failed',
      });
      expect(mockStore.onToolOutputError).toHaveBeenCalledWith('call-1', 'Failed');
    });

    it('parses error tool-output-available event with nested isError', async () => {
      const stream = createSSEStream([
        'data: {"type":"tool-output-available","toolCallId":"call-1","output":{"isError":true,"errorText":"Nested error"}}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolOutputAvailable).toHaveBeenCalledWith('call-1', {
        isError: true,
        errorText: 'Nested error',
      });
      expect(mockStore.onToolOutputError).toHaveBeenCalledWith('call-1', 'Nested error');
    });

    it('extracts error text from content array', async () => {
      const stream = createSSEStream([
        'data: {"type":"tool-output-available","toolCallId":"call-1","isError":true,"output":{"content":[{"type":"text","text":"Error message"}]}}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolOutputError).toHaveBeenCalledWith('call-1', 'Error message');
    });

    it('parses tool-output-error event', async () => {
      const stream = createSSEStream([
        'data: {"type":"tool-output-error","toolCallId":"call-1","output":{"errorText":"Tool failed"}}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onToolOutputAvailable).toHaveBeenCalledWith('call-1', {
        isError: true,
        errorText: 'Tool failed',
      });
      expect(mockStore.onToolOutputError).toHaveBeenCalledWith('call-1', 'Tool failed');
    });

    it('parses finish event', async () => {
      const stream = createSSEStream([
        'data: {"type":"finish"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onSseFinish).toHaveBeenCalled();
    });

    it('parses [DONE] event', async () => {
      const stream = createSSEStream([
        'data: [DONE]',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onSseFinish).toHaveBeenCalled();
    });

    it('ignores unknown event types', async () => {
      const stream = createSSEStream([
        'data: {"type":"text-delta","delta":"test"}',
        'data: {"type":"unknown-type"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onSseStart).not.toHaveBeenCalled();
    });

    it('handles malformed JSON gracefully', async () => {
      const stream = createSSEStream([
        'data: {invalid json}',
        'data: {"type":"finish"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const reader = response.body.getReader();
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onSseFinish).toHaveBeenCalled();
    });

    it('does not tee stream for non-SSE responses', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: 'test' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      const response = await customFetch(mockApi, { method: 'POST' });

      const text = await response.text();
      expect(text).toBe('{"message":"test"}');
    });

    it('does not tee stream for different endpoints', async () => {
      const stream = createSSEStream([
        'data: {"type":"start","messageId":"msg-123"}',
      ]);

      mockFetch.mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const transport = createToolAwareTransport({ api: mockApi });
      const customFetch = (transport as any).fetch;
      await customFetch('/different/api', { method: 'POST' });

      await new Promise(resolve => setTimeout(resolve, 50));

      const mockStore = getMockToolActivityStore();
      expect(mockStore.onSseStart).not.toHaveBeenCalled();
    });
  });
});
