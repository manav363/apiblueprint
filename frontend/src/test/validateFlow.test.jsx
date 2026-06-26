/**
 * Integration test: submit a spec → see the validation result.
 *
 * Wires the real API client (`api.validateSpec`) to the real presentational
 * panel (`SpecValidationPanel`) through the same handler logic ExportPage uses,
 * with only the network boundary mocked. Exercises the full submit → render loop.
 */
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../services/api";
import SpecValidationPanel from "../components/SpecValidationPanel";

function ValidateHarness({ specText }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleValidate() {
    setStatus("checking");
    setError(null);
    setResult(null);
    try {
      setResult(await api.validateSpec(specText));
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("done");
    }
  }

  return (
    <div>
      <button onClick={handleValidate}>Validate</button>
      <SpecValidationPanel status={status} result={result} error={error} />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("spec validation flow", () => {
  it("shows the error list returned by the backend", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: false,
        errors: [{ path: "$.info", message: "'version' is a required property" }],
      }),
    });

    render(<ValidateHarness specText="openapi: 3.0.3" />);
    await user.click(screen.getByRole("button", { name: /validate/i }));

    expect(await screen.findByText(/1 validation error\b/i)).toBeTruthy();
    expect(screen.getByText("$.info")).toBeTruthy();
  });

  it("shows a success banner when the spec is valid", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, errors: [] }),
    });

    render(<ValidateHarness specText="openapi: 3.0.3" />);
    await user.click(screen.getByRole("button", { name: /validate/i }));

    expect(await screen.findByText(/spec is valid openapi/i)).toBeTruthy();
  });
});
