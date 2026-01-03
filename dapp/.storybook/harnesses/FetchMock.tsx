'use client';

import React from 'react';

export type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | undefined | Promise<Response | undefined>;

export default function FetchMock({
  handlers,
  children,
}: {
  handlers: readonly FetchHandler[];
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      for (const handler of handlers) {
        const maybe = await handler(input, init);
        if (maybe) return maybe;
      }
      return originalFetch(input as any, init);
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [handlers]);

  return <>{children}</>;
}

