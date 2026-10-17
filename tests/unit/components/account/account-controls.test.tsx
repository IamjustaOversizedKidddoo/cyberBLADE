// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/lib/identity/privacy-actions", () => ({
  deleteAccountAction: vi.fn(),
  exportUserDataAction: vi.fn().mockResolvedValue({ user: "test", progress: [] }),
}));

import { AccountDataControls } from "@/components/account/AccountDataControls";

describe("AccountDataControls Regression (A-06, A-07)", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function mockShowModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function mockClose() {
      this.removeAttribute("open");
    };
  });

  it("enables delete permanently button with case-insensitive 'delete' (A-07)", async () => {
    const { container } = render(<AccountDataControls />);

    // Click "Delete my account…" to open dialog
    const openBtn = screen.getByRole("button", { name: "Delete my account…" });
    fireEvent.click(openBtn);

    const deleteBtn = screen.getByRole("button", { name: "Delete permanently" });
    expect(deleteBtn).toBeDisabled();

    const input = screen.getByLabelText(/Type DELETE to confirm/i);

    // Typing lowercase 'delete'
    fireEvent.change(input, { target: { value: "delete" } });
    expect(deleteBtn).not.toBeDisabled();

    // Typing uppercase 'DELETE'
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(deleteBtn).not.toBeDisabled();

    // Typing with whitespace '  delete  '
    fireEvent.change(input, { target: { value: "  delete  " } });
    expect(deleteBtn).not.toBeDisabled();

    // Typing invalid text
    fireEvent.change(input, { target: { value: "del" } });
    expect(deleteBtn).toBeDisabled();
    expect(screen.getByText(/Must match "DELETE" \(case-insensitive\)/i)).toBeInTheDocument();
  });

  it("handles export download and sets loading debounce state (A-06)", async () => {
    render(<AccountDataControls />);

    const exportBtn = screen.getByRole("button", { name: "Download my data" });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    // Shows loading label while preparing
    expect(exportBtn).toHaveTextContent("Preparing export…");
    expect(exportBtn).toBeDisabled();
  });
});
