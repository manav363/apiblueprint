import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api.validateSpec", () => {
  it("POSTs the spec text to /api/validate and returns the result", async () => {
    const payload = { valid: true, errors: [] };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const result = await api.validateSpec("openapi: 3.0.3");

    expect(result).toEqual(payload);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/api\/validate$/);
    expect(options.method).toBe("POST");
    expect(options.body).toBe("openapi: 3.0.3");
  });

  it("throws a helpful error when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "boom" }),
    });

    await expect(api.validateSpec("bad")).rejects.toThrow("boom");
  });
});
