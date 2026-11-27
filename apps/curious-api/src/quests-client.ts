export interface QuestsService {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export type QuestsFailure = "missing_binding" | "denied";

export class QuestsClientError extends Error {
  readonly failure: QuestsFailure;

  constructor(failure: QuestsFailure) {
    super(failure);
    this.name = "QuestsClientError";
    this.failure = failure;
  }
}

const BINDING_ORIGIN = "https://cambium-quests.internal";

export async function callQuests(binding: QuestsService | undefined, path: string, init: RequestInit = {}): Promise<Response> {
  if (!binding) throw new QuestsClientError("missing_binding");
  if (!path.startsWith("/") || path.startsWith("//")) throw new QuestsClientError("denied");
  let url: URL;
  try {
    url = new URL(path, BINDING_ORIGIN);
  } catch {
    throw new QuestsClientError("denied");
  }
  if (url.origin !== BINDING_ORIGIN) throw new QuestsClientError("denied");

  let response: Response;
  try {
    response = await binding.fetch(url, { ...init, redirect: "manual" });
  } catch {
    throw new QuestsClientError("denied");
  }
  if (response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)) {
    throw new QuestsClientError("denied");
  }
  return response;
}
