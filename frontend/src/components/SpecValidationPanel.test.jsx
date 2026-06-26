import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SpecValidationPanel from "./SpecValidationPanel";

describe("SpecValidationPanel", () => {
  it("renders nothing in the idle state with no result", () => {
    const { container } = render(<SpecValidationPanel status="idle" result={null} error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a checking indicator while validating", () => {
    render(<SpecValidationPanel status="checking" result={null} error={null} />);
    expect(screen.getByText(/validating spec/i)).toBeTruthy();
  });

  it("shows a success message for a valid spec", () => {
    render(<SpecValidationPanel status="done" result={{ valid: true, errors: [] }} error={null} />);
    expect(screen.getByText(/spec is valid openapi/i)).toBeTruthy();
  });

  it("lists each validation error with its path and message", () => {
    const result = {
      valid: false,
      errors: [
        { path: "$.info", message: "'version' is a required property" },
        { path: "$.paths", message: "is not of type 'object'" },
      ],
    };
    render(<SpecValidationPanel status="done" result={result} error={null} />);

    expect(screen.getByText(/2 validation errors/i)).toBeTruthy();
    expect(screen.getByText("$.info")).toBeTruthy();
    expect(screen.getByText(/'version' is a required property/)).toBeTruthy();
    expect(screen.getByText("$.paths")).toBeTruthy();
  });

  it("uses singular wording for a single error", () => {
    const result = { valid: false, errors: [{ path: "$", message: "broken" }] };
    render(<SpecValidationPanel status="done" result={result} error={null} />);
    expect(screen.getByText(/1 validation error\b/i)).toBeTruthy();
  });

  it("surfaces a transport error", () => {
    render(<SpecValidationPanel status="done" result={null} error="Network down" />);
    expect(screen.getByRole("alert").textContent).toMatch(/network down/i);
  });
});
