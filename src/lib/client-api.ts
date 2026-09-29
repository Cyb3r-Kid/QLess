export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(10000);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    response = await fetch(url, {
      cache: "no-store",
      ...init,
      signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(
      "We can’t reach Qless. Check your connection; your place is still saved.",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error ?? "Something went wrong. Please try again."),
      { status: response.status },
    );
  return data as T;
}
