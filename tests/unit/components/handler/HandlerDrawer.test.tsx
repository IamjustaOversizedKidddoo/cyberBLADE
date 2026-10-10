// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HandlerDrawer } from "@/components/handler/HandlerDrawer";

// Mock server action
vi.mock("@/app/(app)/handler/actions", () => ({
  askHandlerAction: vi.fn(async () => ({
    reply: "Mocked Handler response in Professor Mode.",
    commandRecognized: "what_is",
    providerUsed: "heuristic",
  })),
}));

describe("HandlerDrawer Component", () => {
  it("renders closed by default with trigger button", () => {
    render(
      <HandlerDrawer
        context={{ kind: "lesson", lessonId: "test-lesson", lessonTitle: "TCP & UDP" }}
        operatorHandle="TEST_OP"
      />,
    );

    const trigger = screen.getByRole("button", { name: /THE HANDLER/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens drawer when trigger is clicked and displays suggestion chips", () => {
    render(
      <HandlerDrawer
        context={{ kind: "lesson", lessonId: "test-lesson", lessonTitle: "TCP & UDP" }}
        operatorHandle="TEST_OP"
      />,
    );

    const trigger = screen.getByRole("button", { name: /THE HANDLER/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("What is this?")).toBeInTheDocument();
    expect(screen.getByText("Why does it exist?")).toBeInTheDocument();
    expect(screen.getByText("Simplify")).toBeInTheDocument();
    expect(screen.getByText("ASCII Diagram")).toBeInTheDocument();
  });

  it("displays challenge offline indicator when isChallenge is true", () => {
    render(
      <HandlerDrawer
        context={{ kind: "lab", isChallenge: true, labTitle: "Operation Iron Gate" }}
        operatorHandle="CHALLENGER"
        defaultOpen={true}
      />,
    );

    expect(screen.getByText(/OFFLINE \/\/ CHALLENGE/i)).toBeInTheDocument();
    expect(screen.getByText(/COMM LINK SEVERED/i)).toBeInTheDocument();
    // In challenge mode, suggestion chips should NOT be shown
    expect(screen.queryByText("What is this?")).not.toBeInTheDocument();
  });
});
