export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api";
  
const AUTH_MUTATION_ENDPOINTS = new Set([
  "/auth/token",
  "/auth/refresh",
  "/auth/logout",
]);

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem("token") ?? localStorage.getItem("token");
}

function setStoredToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    sessionStorage.setItem("token", token);
    localStorage.setItem("token", token);
  } else {
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    setStoredToken(null);
    return false;
  }

  const data = await response.json().catch(() => null);
  if (!data?.access_token) {
    setStoredToken(null);
    return false;
  }

  setStoredToken(data.access_token);
  return true;
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = getStoredToken();

  const hasBody = options?.body !== undefined && options?.body !== null;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...((options?.headers as Record<string, string> | undefined) ?? {}),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error(
      `Network error: cannot reach backend at ${API_BASE_URL}. Ensure FastAPI is running on port 8000.`,
    );
  }

  if (response.status === 401 && !AUTH_MUTATION_ENDPOINTS.has(endpoint)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryToken = getStoredToken();
      const retryHeaders: Record<string, string> = {
        ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...((options?.headers as Record<string, string> | undefined) ?? {}),
      };

      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: "include",
        headers: retryHeaders,
      });
    }
  }

  if (response.status === 401 && !AUTH_MUTATION_ENDPOINTS.has(endpoint)) {
    setStoredToken(null);
    return null as T;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}
export async function fetchBlob(endpoint: string): Promise<Blob> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryToken = getStoredToken();
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
        },
      });
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.statusText}`);
  }

  return response.blob();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  put: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: "DELETE" }),
  post: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),
  login: async (formData: FormData) => {
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Login failed");
    }
    return response.json();
  },

  upload: <T>(endpoint: string, formData: FormData) => {
    const attempt = async () => {
      const token = getStoredToken();
      return fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    };

    return attempt()
      .then(async (response) => {
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return attempt();
          }

          setStoredToken(null);
          return response;
        }

        return response;
      })
      .then(async (response) => {
        if (!response) {
          return null as T;
        }

        if (response.status === 401) {
          return null as T;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `API error: ${response.statusText}`,
          );
        }

        if (response.status === 204) {
          return undefined as T;
        }

        const responseText = await response.text();
        if (!responseText) {
          return undefined as T;
        }

        return JSON.parse(responseText) as T;
      });
  },
  fetchBlob: (endpoint: string) => fetchBlob(endpoint),
  logout: () =>
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }),
  setToken: setStoredToken,
};
