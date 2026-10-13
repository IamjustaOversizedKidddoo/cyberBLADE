# Authoring Guide: SOC Investigation Questions (SAL1/BTL1-Style)

## Principles for Authoring Verifiable Questions

Investigation questions allow learners to test and prove analytical findings (e.g. "How many distinct accounts were targeted?", "Which external IP initiated the brute-force spray?", "What was the earliest failure timestamp?").

All questions in CyberBLADE must adhere to the **Four Invariants of Question Safety**:
1. **Never Leak Ground Truth:** The question stem must never disclose the answer or pre-judge incident severity.
   - ✗ Bad: *"Which malicious external IP was used by the attacker?"*
   - ✓ Good: *"Which external IP address generated the highest volume of authentication failures?"*
2. **Deterministic Answerability:** Every question must have an associated **Reference Query** in BladeQL that produces the exact answer when executed against the scenario's synthetic log lake.
3. **Robust Normalization:** Evaluators must accept defanged representations (e.g., `192[.]0[.]2[.]1`, `hxxp://`), alternative case, path slashes, and reasonable timestamp tolerances ($\pm 60$s).
4. **Anti-Brute Force Protection:** Free-form entity and numeric questions are capped at 5 attempts before lockout. Distractors for choice questions must be authentic values sampled directly from the scenario's background dataset.

---

## Question Types & Normalization Contracts

### 1. `numeric`
- **Use Case:** Event counts, byte totals, distinct cardinalities.
- **Contract:** Number parsed with comma stripping.
- **Example Stem:** *"How many failed authentication events occurred across the enterprise during the logged shift?"*
- **Reference Query:** `source="auth" outcome="failure" | stats count`

### 2. `entity`
- **Use Case:** IPs, domain names, usernames, hosts, hashes, filenames.
- **Contract:** Case-insensitive, trimmed, defanged IoCs automatically refanged (`hxxp` -> `http`, `[.]` -> `.`), path separators normalized to forward slashes.
- **Example Stem:** *"Which source IP address generated the highest number of connection attempts in the firewall logs?"*
- **Reference Query:** `source="firewall" | stats count by src_ip | sort -count | head 1 | table src_ip`

### 3. `timestamp`
- **Use Case:** Time of initial access, peak outbound spike, earliest event.
- **Contract:** ISO-8601 string evaluated with a documented tolerance window (typically $\pm 60$ seconds to $\pm 120$ seconds).
- **Example Stem:** *"What was the timestamp of the earliest recorded authentication event?"*
- **Reference Query:** `source="auth" | sort timestamp | head 1 | table timestamp`

### 4. `single_choice`
- **Use Case:** Categorical classification, primary process identification.
- **Contract:** 1 correct answer + 3 plausible distractors sampled from the variant's actual log stream.
- **Example Stem:** *"Which primary process is recorded executing commands in the endpoint logs?"*
- **Reference Query:** `source="endpoint" | top 1 process`

### 5. `multi_select`
- **Use Case:** Identifying all active telemetry streams or affected departments.
- **Contract:** Exact set equality (all matching items selected, zero incorrect distractors selected).
- **Example Stem:** *"Select all telemetry sources that contain events in this investigation's dataset:"*
- **Reference Query:** `stats count by source | table source`

### 6. `ordering`
- **Use Case:** Reconstructing chronological kill-chain progression.
- **Contract:** Strict array sequence matching.
- **Example Stem:** *"Arrange the tactical stages in chronological order as observed across telemetry:"*

---

## Authoring Question Templates

When extending an L1 family template:
```typescript
{
  id: "q-failed-logon-count",
  type: "numeric",
  skillTags: ["auth-analysis", "counting"],
  difficulty: "beginner",
  points: 10,
  hints: [
    "Look for authentication telemetry under `source=\"auth\"`.",
    "Filter for `outcome=\"failure\"` and count the rows.",
  ],
  stemTemplate: "How many failed authentication events occurred across the enterprise during the shift?",
  referenceQueryTemplate: 'source="auth" outcome="failure" | stats count',
  compute: (scenario, dataset) => {
    const res = executeBladeQL('source="auth" outcome="failure" | stats count', dataset.events);
    const count = Number(res.events[0]?.count ?? 0);
    return {
      stem: "How many failed authentication events occurred across the enterprise during the shift?",
      referenceAnswer: count,
      referenceQuery: 'source="auth" outcome="failure" | stats count',
      debrief: `Querying authentication failures using \`source="auth" outcome="failure"\` returns ${count} total failure events.`,
    };
  },
}
```

---

## Validation & Verification Checklist
Before submitting a new question:
- [ ] Run `npx vitest run tests/unit/lib/lab-engine/soc/query-questions.test.ts`
- [ ] Confirm reference query executes within 100ms and returns a non-empty, unique answer.
- [ ] Confirm the question stem does not contain the answer, verdict, or attacker moniker.
- [ ] Run `npm run soc:review-pack -- --family <id>` to verify questions and answers export correctly.
