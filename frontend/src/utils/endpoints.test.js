import { describe, it, expect } from "vitest";
import { normalizeEndpointPath, buildSuggestedOperationId } from "./endpoints";

describe("normalizeEndpointPath", () => {
  it("returns '/' for empty or whitespace input", () => {
    expect(normalizeEndpointPath("")).toBe("/");
    expect(normalizeEndpointPath("   ")).toBe("/");
    expect(normalizeEndpointPath(null)).toBe("/");
  });

  it("prefixes a leading slash when missing", () => {
    expect(normalizeEndpointPath("users")).toBe("/users");
  });

  it("leaves an already-rooted path untouched", () => {
    expect(normalizeEndpointPath("/users/{id}")).toBe("/users/{id}");
  });
});

describe("buildSuggestedOperationId", () => {
  it("camel-cases method and path segments", () => {
    expect(buildSuggestedOperationId("GET", "/users")).toBe("getUsers");
  });

  it("turns path params into by-<name> segments", () => {
    expect(buildSuggestedOperationId("GET", "/users/{id}")).toBe("getUsersById");
  });

  it("falls back to just the method for an empty path", () => {
    expect(buildSuggestedOperationId("GET", "")).toBe("get");
  });

  it("lowercases the method and strips unsafe characters", () => {
    expect(buildSuggestedOperationId("POST", "/orders/{orderId}/items")).toBe(
      "postOrdersByOrderIdItems"
    );
  });
});
