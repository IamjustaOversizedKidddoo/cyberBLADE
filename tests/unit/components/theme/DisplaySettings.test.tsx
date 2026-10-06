// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DisplaySettings } from "@/components/theme/DisplaySettings";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.contrast;
  delete document.documentElement.dataset.motion;
});

test("high contrast toggle updates the page and persists", async () => {
  render(<DisplaySettings />);
  const button = screen.getByRole("button", { name: "High contrast" });
  expect(button).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(button);
  expect(document.documentElement.dataset.contrast).toBe("high");
  expect(button).toHaveAttribute("aria-pressed", "true");
  expect(localStorage.getItem("neon.display")).toContain("high");
});

test("reduce motion toggle updates the page", async () => {
  render(<DisplaySettings />);
  await userEvent.click(screen.getByRole("button", { name: "Reduce motion" }));
  expect(document.documentElement.dataset.motion).toBe("reduce");
});
