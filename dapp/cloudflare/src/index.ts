import type { Env } from './types';
import { handleEmailRequest } from './routes/email';
import { handleStateRequest } from './routes/state';
import { StateDurableObject } from './durable/state';

const STATE_PATH = '/state';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(STATE_PATH)) {
      return handleStateRequest(request, env);
    }
    return handleEmailRequest(request, env);
  },
};

export { StateDurableObject };
