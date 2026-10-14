/**
 * Review queue for AI grades (operator tool; reviewers use pseudonyms).
 *   npm run soc:ai:review -- list
 *   npm run soc:ai:review -- show <itemId>
 *   npm run soc:ai:review -- accept <itemId> --reviewer <pseudonym>
 *   npm run soc:ai:review -- override <itemId> --band <0-3> --reviewer <pseudonym>
 * Accept/override write a NEW grade record that supersedes the AI one (append-only).
 */
import { getAiGradingStore } from "../lib/lab-engine/soc/ai-grading/runtime";
import { acceptReviewItem, overrideReviewItem } from "../lib/lab-engine/soc/ai-grading/review";
import { loadAiRubric } from "../lib/lab-engine/soc/ai-grading/config";
import type { Band } from "../lib/lab-engine/soc/ai-grading/types";

const [cmd, itemId] = process.argv.slice(2);
const opt = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const store = getAiGradingStore();

async function main() {
  if (cmd === "list") {
    const items = await store.listReviewItems({ status: "open", limit: 200 });
    for (const i of items) console.log(`${i.id}  ${i.reason.padEnd(18)} ${i.criterionId.padEnd(28)} submission=${i.submissionId.slice(0, 8)}  ${i.createdAt}`);
    console.log(`${items.length} open item(s)`);
  } else if (cmd === "show") {
    const [item] = (await store.listReviewItems({})).filter((r) => r.id === itemId);
    if (!item) throw new Error("item not found");
    const grade = await store.getGrade(item.gradeId);
    console.log(JSON.stringify({ item, grade }, null, 2));
    for (const r of await store.listRawOutputs(item.gradeId)) console.log(`--- raw sample ${r.sampleIndex} try ${r.attempt}\n${r.rawText}`);
  } else if (cmd === "accept") {
    const g = await acceptReviewItem(store, { itemId, reviewer: opt("reviewer") ?? "", now: new Date() });
    console.log(`accepted -> new grade ${g.id} (band ${g.band})`);
  } else if (cmd === "override") {
    const band = Number(opt("band"));
    if (![0, 1, 2, 3].includes(band)) throw new Error("--band must be 0..3");
    const g = await overrideReviewItem(store, { itemId, reviewer: opt("reviewer") ?? "", band: band as Band, rubric: loadAiRubric(), now: new Date() });
    console.log(`overridden -> new grade ${g.id} (band ${g.band})`);
  } else {
    console.log("usage: soc:ai:review <list|show|accept|override> ...");
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
