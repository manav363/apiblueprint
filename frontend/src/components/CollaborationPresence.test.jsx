import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CollaborationPresence from "./CollaborationPresence";

describe("CollaborationPresence", () => {
  it("renders nothing when not connected", () => {
    const { container } = render(
      <CollaborationPresence collaborators={[{ clientId: "a", name: "Ada" }]} status="idle" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the roster is empty", () => {
    const { container } = render(<CollaborationPresence collaborators={[]} status="connected" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Only you' for a solo session", () => {
    render(
      <CollaborationPresence collaborators={[{ clientId: "a", name: "Ada" }]} status="connected" />
    );
    expect(screen.getByText(/only you/i)).toBeTruthy();
  });

  it("counts the other collaborators", () => {
    render(
      <CollaborationPresence
        collaborators={[
          { clientId: "a", name: "Ada Lovelace" },
          { clientId: "b", name: "Bob" },
          { clientId: "c", name: "Cleo" },
        ]}
        status="connected"
      />
    );
    expect(screen.getByText(/2 others editing/i)).toBeTruthy();
    // Initials avatar for Ada Lovelace.
    expect(screen.getByTitle("Ada Lovelace").textContent).toBe("AL");
  });
});
