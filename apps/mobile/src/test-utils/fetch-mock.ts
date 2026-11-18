// Shared fetch-mock scaffolding for lib tests. Lives outside __tests__ so
// jest never treats it as a suite.

export const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

export function installFetchMock(): jest.Mock {
  const fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
