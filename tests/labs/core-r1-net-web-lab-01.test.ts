import { describe, expect, it } from "vitest";
import { FLAG, openLab, SEEDS } from "./helpers";

describe("core-r1-net-web-lab-01", () => {
  it.each(SEEDS)("solves lab with seed %s using curl", async (seed) => {
    const { run, check } = await openLab("core-r1-net-web-lab-01", seed);

    // o1 & o2: curl -I http://intranet.corp.example/
    const headOut = run("curl -I http://intranet.corp.example/").stdout;

    const serverMatch = headOut.match(/^Server:\s*(.+)$/im);
    expect(serverMatch).not.toBeNull();
    const server = serverMatch![1].trim();
    expect(check("o1", server)).toBe(true);

    const locMatch = headOut.match(/^Location:\s*(.+)$/im);
    expect(locMatch).not.toBeNull();
    const redirectUrl = locMatch![1].trim();
    expect(check("o2", redirectUrl)).toBe(true);

    // o3: curl http://intranet.corp.example/admin/notes to get the flag
    const notesOut = run("curl http://intranet.corp.example/admin/notes").stdout;
    const flagMatch = notesOut.match(FLAG);
    expect(flagMatch).not.toBeNull();
    const flag = flagMatch![0];
    expect(check("o3", flag)).toBe(true);
  });
});
