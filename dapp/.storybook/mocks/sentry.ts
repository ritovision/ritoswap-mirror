type Scope = {
  setTag: (key: string, value: string) => void;
  setContext: (name: string, context: unknown) => void;
};

const noop = () => {};

export const init = noop;

export const captureException = noop;

export const withScope = (callback: (scope: Scope) => void) => {
  callback({
    setTag: noop,
    setContext: noop,
  });
};

export const captureRequestError = noop;

export const captureRouterTransitionStart = noop;
