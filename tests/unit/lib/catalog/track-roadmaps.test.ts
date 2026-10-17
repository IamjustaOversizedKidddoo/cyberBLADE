import { describe, it, expect } from "vitest";
import { TRACKS } from "@/lib/catalog/tracks";

describe("Track Roadmap Resolution Regression (A-03)", () => {
  it("includes all advertised launch tracks in the catalogue", () => {
    const trackIds = TRACKS.map((t) => t.id);
    expect(trackIds).toContain("pentest");
    expect(trackIds).toContain("cloud");
    expect(trackIds).toContain("purple");
    expect(trackIds).toContain("soc");
  });

  it("identifies pentest as Penetration Tester / VAPT Analyst", () => {
    const pentest = TRACKS.find((t) => t.id === "pentest");
    expect(pentest).toBeDefined();
    expect(pentest?.title).toBe("Penetration Tester / VAPT Analyst");
    expect(pentest?.group).toBe("Attack");
  });

  it("identifies cloud as Cloud Security in Build group", () => {
    const cloud = TRACKS.find((t) => t.id === "cloud");
    expect(cloud).toBeDefined();
    expect(cloud?.title).toBe("Cloud Security");
    expect(cloud?.group).toBe("Build");
  });
});
