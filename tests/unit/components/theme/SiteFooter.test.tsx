// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/theme/SiteFooter";

test("credits the Hacked font author", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("link", { name: /Hacked font by David Libeau/ })).toHaveAttribute(
    "href",
    "https://hackedfont.com",
  );
  expect(screen.getByRole("link", { name: /credits/i })).toHaveAttribute("href", "/credits");
});
