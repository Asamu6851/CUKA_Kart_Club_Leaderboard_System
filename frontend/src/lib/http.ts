import { readStoredAuth } from "./auth-storage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const storedAuth = readStoredAuth();

  if (storedAuth?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${storedAuth.accessToken}`);
  }

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });
  const contentType = response.headers.get("Content-Type") || "";
  const responseData =
    contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const message = resolveErrorMessage(responseData);
    throw new Error(message || "Request failed.");
  }

  return responseData as T;
}

function resolveErrorMessage(responseData: unknown) {
  if (typeof responseData === "string") {
    return responseData;
  }

  if (responseData && typeof responseData === "object") {
    const payload = responseData as Record<string, unknown>;
    const message = payload.message;
    if (typeof message === "string") {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join("，");
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }
  }

  return "Request failed.";
}
