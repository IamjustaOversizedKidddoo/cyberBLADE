// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { TypingText } from "@/components/theme/TypingText";

const typed = (container: HTMLElement) => container.querySelector("[data-typed]")?.textContent;

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.useRealTimers();
});

test("screen readers always get the full text", () => {
  vi.useFakeTimers();
  render(<TypingText text="ACCESS GRANTED" />);
  expect(screen.getByText("ACCESS GRANTED")).toHaveClass("sr-only");
});

test("reduced motion shows the full text immediately", () => {
  document.documentElement.dataset.motion = "reduce";
  const { container } = render(<TypingText text="ACCESS GRANTED" />);
  expect(typed(container)).toBe("ACCESS GRANTED");
});

test("types out the full text over time", () => {
  vi.useFakeTimers();
  const { container } = render(<TypingText text="ACCESS GRANTED" />);
  expect(typed(container)).toBe("");
  act(() => { vi.advanceTimersByTime(18 * 7); });
  expect(typed(container)).toBe("ACCESS ");
  act(() => { vi.advanceTimersByTime(18 * 7); });
  expect(typed(container)).toBe("ACCESS GRANTED");
});

test("typed copy is hidden from screen readers", () => {
  const { container } = render(<TypingText text="hi" />);
  expect(container.querySelector("[data-typed]")).toHaveAttribute("aria-hidden", "true");
});
