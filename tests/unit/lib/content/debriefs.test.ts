import { describe, expect, it } from "vitest";
import { LAB_DEBRIEFS, getLabDebrief } from "@/lib/content/debriefs";
import { listLabs } from "@/lib/lab-engine/labs";

describe("LAB_DEBRIEFS", () => {
  it("provides a debrief for all labs in the curriculum", async () => {
    const labs = await listLabs("labs");
    expect(labs.length).toBe(44);

    for (const lab of labs) {
      const debrief = getLabDebrief(lab.id);
      expect(debrief, `Missing debrief for lab ${lab.id}`).toBeDefined();
      expect(debrief?.concept.length).toBeGreaterThan(10);
      expect(debrief?.realWorld.length).toBeGreaterThan(10);
      expect(debrief?.commonMistake.length).toBeGreaterThan(10);
      expect(debrief?.goFurther.length).toBeGreaterThan(10);

      const totalWords = `${debrief?.concept} ${debrief?.realWorld} ${debrief?.commonMistake} ${debrief?.goFurther}`
        .split(/\s+/)
        .filter(Boolean).length;
      expect(totalWords, `Debrief for ${lab.id} exceeded 120 words (${totalWords} words)`).toBeLessThanOrEqual(120);
    }
  });
});
