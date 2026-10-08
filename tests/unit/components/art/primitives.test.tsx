// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Annotation } from "@/components/art/Annotation";
import { DossierCard } from "@/components/art/DossierCard";
import { EditorialIllustration } from "@/components/art/EditorialIllustration";
import { HalftoneField } from "@/components/art/HalftoneField";
import { InkEdge } from "@/components/art/InkEdge";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { PosterHeading } from "@/components/art/PosterHeading";
import { RankNode } from "@/components/art/RankNode";
import { TechnicalDiagram } from "@/components/art/TechnicalDiagram";
import { VisualDivider } from "@/components/art/VisualDivider";

test("textures and dividers are hidden from assistive technology", () => {
  const { container } = render(
    <div>
      <HalftoneField tone="cyan" />
      <NoiseLayer kind="grain" />
      <InkEdge edge="bottom" tone="void" />
      <VisualDivider kind="schematic" />
    </div>,
  );
  const layers = container.firstElementChild!.children;
  expect(layers).toHaveLength(4);
  for (const el of Array.from(layers)) expect(el.getAttribute("aria-hidden")).toBe("true");
});

test("PosterHeading renders exactly one semantic heading, even with glitch", () => {
  render(<PosterHeading as="h1" lines={["RANK_00"]} size="hero" glitch />);
  const headings = screen.getAllByRole("heading");
  expect(headings).toHaveLength(1);
  expect(headings[0].tagName).toBe("H1");
  expect(headings[0]).toHaveAccessibleName("RANK_00");
});

test("PosterHeading with several lines reads as one sentence", () => {
  render(<PosterHeading lines={["YOU'RE ENTERING", "A TRAINING SYSTEM_"]} size="section" />);
  expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName("YOU'RE ENTERING A TRAINING SYSTEM_");
});

test("TechnicalDiagram is an image with a name and a readable list of its steps", () => {
  render(
    <TechnicalDiagram
      title="Learning loop"
      nodes={[
        { id: "a", x: 20, y: 20, label: "Briefing" },
        { id: "b", x: 80, y: 80, label: "Lab" },
      ]}
      links={[{ from: "a", to: "b" }]}
    />,
  );
  expect(screen.getByRole("img", { name: "Learning loop" })).toBeInTheDocument();
  const items = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(items).toEqual(["Briefing", "Lab"]);
});

test("Annotation text is real text; its line is decorative", () => {
  const { container } = render(<Annotation from={[10, 10]} to={[40, 40]} label="VISOR: SIM-ONLY" />);
  expect(screen.getByText("VISOR: SIM-ONLY")).toBeInTheDocument();
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

describe("EditorialIllustration (art slot)", () => {
  test("demands alt text unless marked decorative", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<EditorialIllustration slot="operator" />)).toThrow(/alt/);
  });
  test("without src it renders the designed placeholder, labelled by the alt", () => {
    render(<EditorialIllustration slot="operator" alt="An operator wearing a visor" />);
    expect(screen.getByRole("img", { name: "An operator wearing a visor" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
  test("with src it renders the artwork image", () => {
    render(<EditorialIllustration slot="operator" alt="Ink operator" src="/art/operator.png" />);
    expect(screen.getByRole("img", { name: "Ink operator" }).tagName).toBe("IMG");
  });
  test("decorative slots are hidden", () => {
    const { container } = render(<EditorialIllustration slot="system" decorative />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

test("DossierCard redaction removes the words, it doesn't just cover them", () => {
  render(
    <DossierCard fileNo="FILE 0007" title="Future operations" redact>
      Threat Hunter briefing notes
    </DossierCard>,
  );
  expect(screen.queryByText(/briefing notes/)).toBeNull();
  expect(screen.getByText("Future operations")).toBeInTheDocument();
  expect(screen.getByText("FILE 0007")).toBeInTheDocument();
});

test("RankNode states are words, not just colours", () => {
  const base = { rank: 1, name: "Operator", xp: 0, lessons: { done: 0, total: 9 }, mission: "Networking, Linux, Windows" };
  const { rerender } = render(<RankNode {...base} status="locked" />);
  expect(screen.getByText("SECTOR LOCKED")).toBeInTheDocument();
  rerender(<RankNode {...base} status="cleared" />);
  expect(screen.getByText("CLEARED")).toBeInTheDocument();
  rerender(<RankNode {...base} status="current" />);
  expect(screen.getByText("01")).toBeInTheDocument();
  expect(screen.getByText("CURRENT")).toBeInTheDocument();
});
