import { route, type WorkerEnv } from "./router.ts";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return route(request, env);
  },
};
