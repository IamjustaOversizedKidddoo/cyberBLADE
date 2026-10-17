import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateCredentialId, isValidCredentialId } from "@/lib/certificates/slug";
import { validateDisplayName } from "@/lib/certificates/service";
import { evaluateTrackEligibility } from "@/lib/certificates/eligibility";
import { buildLearnerExport } from "@/lib/identity/learner-export";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { Ctx } from "@/lib/progress/service";

describe("certificate slug generator and validator", () => {
  it("generates unguessable 128-bit slugs with cbl_ prefix and 32 hex characters", () => {
    const slug1 = generateCredentialId();
    const slug2 = generateCredentialId();
    expect(slug1).toMatch(/^cbl_[0-9a-f]{32}$/);
    expect(slug2).toMatch(/^cbl_[0-9a-f]{32}$/);
    expect(slug1).not.toBe(slug2);
    expect(isValidCredentialId(slug1)).toBe(true);
    expect(isValidCredentialId(slug2)).toBe(true);
  });

  it("rejects malformed or short credential IDs", () => {
    expect(isValidCredentialId("")).toBe(false);
    expect(isValidCredentialId("cbl_short")).toBe(false);
    expect(isValidCredentialId("cbl_" + "g".repeat(32))).toBe(false); // non-hex
    expect(isValidCredentialId("invalid_prefix_0123456789abcdef0123456789abcdef")).toBe(false);
  });
});

describe("recipient display name validation", () => {
  it("accepts valid names between 2 and 60 characters", () => {
    expect(validateDisplayName("Alex Mercer")).toBe("Alex Mercer");
    expect(validateDisplayName("  Sarah Connor  ")).toBe("Sarah Connor");
    expect(validateDisplayName("Dr. Jane Doe, CISSP")).toBe("Dr. Jane Doe, CISSP");
  });

  it("rejects names that are too short or too long", () => {
    expect(() => validateDisplayName("")).toThrow(/between 2 and 60/);
    expect(() => validateDisplayName("A")).toThrow(/between 2 and 60/);
    expect(() => validateDisplayName("x".repeat(61))).toThrow(/between 2 and 60/);
  });

  it("rejects markup or control characters to prevent injection", () => {
    expect(() => validateDisplayName("<script>alert(1)</script>")).toThrow(/invalid characters/);
    expect(() => validateDisplayName("Alex > Admin")).toThrow(/invalid characters/);
    expect(() => validateDisplayName("Jane\0Doe")).toThrow(/invalid characters/);
  });
});

describe("track completion and certificate eligibility evaluation", () => {
  let repo: MemoryProgressRepo;
  let ctx: Ctx;
  const user = "u-cert-test";

  beforeEach(() => {
    repo = new MemoryProgressRepo();
    ctx = {
      repo,
      content: {} as any,
      now: () => new Date("2026-10-17T12:00:00Z"),
    } as unknown as Ctx;
  });

  it("Core Operator: ineligible if challenge 0 not passed; eligible when passed", async () => {
    const before = await evaluateTrackEligibility(ctx, user, "core", "Operator");
    expect(before.eligible).toBe(false);
    expect(before.reason).toMatch(/Capstone Challenge/i);

    // Pass Rank 0 challenge
    await repo.createChallenge({
      userId: user,
      rank: 0,
      labAttemptId: "attempt-0",
      status: "passed",
      finishedAt: "2026-10-17T11:00:00Z",
    });

    const after = await evaluateTrackEligibility(ctx, user, "core", "Operator");
    expect(after.eligible).toBe(true);
    expect(after.snapshot).toMatchObject({ rank: 1, challengeRank: 0 });
  });

  it("Core Watcher: ineligible if challenge 1 not passed; eligible when passed", async () => {
    const before = await evaluateTrackEligibility(ctx, user, "core", "Watcher");
    expect(before.eligible).toBe(false);

    await repo.createChallenge({
      userId: user,
      rank: 1,
      labAttemptId: "attempt-1",
      status: "passed",
      finishedAt: "2026-10-17T11:00:00Z",
    });

    const after = await evaluateTrackEligibility(ctx, user, "core", "Watcher");
    expect(after.eligible).toBe(true);
    expect(after.snapshot).toMatchObject({ rank: 2, challengeRank: 1 });
  });

  it("SOC L1: ineligible without passing exam; eligible when outcome report or exam score >= 70", async () => {
    const before = await evaluateTrackEligibility(ctx, user, "soc", "Tier 1 Analyst");
    expect(before.eligible).toBe(false);

    // Save passing exam outcome report
    await repo.saveSocExamOutcomeReport({
      userId: user,
      certFamily: "soc-l1",
      examDate: "2026-10-17",
      passed: true,
      consentVersion: "v1",
    });

    const after = await evaluateTrackEligibility(ctx, user, "soc", "Tier 1 Analyst");
    expect(after.eligible).toBe(true);
    expect(after.snapshot).toMatchObject({ tier: "Tier 1" });
  });

  it("rejects unknown tracks or levels", async () => {
    const res = await evaluateTrackEligibility(ctx, user, "invalid-track", "Expert");
    expect(res.eligible).toBe(false);
    expect(res.reason).toMatch(/not recognized/);
  });
});

describe("repository certificates persistence and verification", () => {
  let repo: MemoryProgressRepo;
  const user = "u-repo-test";
  const slug = generateCredentialId();

  beforeEach(() => {
    repo = new MemoryProgressRepo();
  });

  it("saves and lists certificates, enforcing idempotency per (userId, trackId, level)", async () => {
    const cert1 = await repo.saveCertificate({
      userId: user,
      trackId: "core",
      level: "Operator",
      nameAsChosen: "Alex Morgan",
      credentialId: slug,
      issuedAt: "2026-10-17T10:00:00Z",
      revokedAt: null,
      revocationReason: null,
      scoreSnapshot: { rank: 1 },
    });

    expect(cert1.id).toBeDefined();
    expect(cert1.credentialId).toBe(slug);

    // Idempotent retry returns existing record
    const cert2 = await repo.saveCertificate({
      userId: user,
      trackId: "core",
      level: "Operator",
      nameAsChosen: "Alex Duplicate",
      credentialId: generateCredentialId(),
      issuedAt: "2026-10-17T11:00:00Z",
      revokedAt: null,
      revocationReason: null,
      scoreSnapshot: { rank: 1 },
    });
    expect(cert2.id).toBe(cert1.id);
    expect(cert2.credentialId).toBe(slug);

    const list = await repo.listCertificates(user);
    expect(list).toHaveLength(1);
    expect(list[0].nameAsChosen).toBe("Alex Morgan");
  });

  it("public verification returns only safe public fields", async () => {
    await repo.saveCertificate({
      userId: user,
      trackId: "soc",
      level: "Tier 1 Analyst",
      nameAsChosen: "Sam Vance",
      credentialId: slug,
      issuedAt: "2026-10-17T10:00:00Z",
      revokedAt: null,
      revocationReason: null,
      scoreSnapshot: { score: 95 },
    });

    const verify = await repo.verifyCertificate(slug);
    expect(verify).toEqual({
      credentialId: slug,
      nameAsChosen: "Sam Vance",
      trackId: "soc",
      level: "Tier 1 Analyst",
      issuedAt: "2026-10-17T10:00:00Z",
      status: "valid",
      revokedAt: null,
    });

    expect((verify as any).userId).toBeUndefined();
    expect((verify as any).id).toBeUndefined();
  });

  it("revocation updates status to revoked with reason", async () => {
    await repo.saveCertificate({
      userId: user,
      trackId: "core",
      level: "Watcher",
      nameAsChosen: "Taylor Swift",
      credentialId: slug,
      issuedAt: "2026-10-17T10:00:00Z",
      revokedAt: null,
      revocationReason: null,
      scoreSnapshot: {},
    });

    const revoked = await repo.revokeCertificate(slug, "Honor code violation");
    expect(revoked).toBe(true);

    const verify = await repo.verifyCertificate(slug);
    expect(verify?.status).toBe("revoked");
    expect(verify?.revokedAt).toBeDefined();
  });

  it("deleteUserData cleans up certificates (GDPR Right to Erasure)", async () => {
    await repo.saveCertificate({
      userId: user,
      trackId: "core",
      level: "Operator",
      nameAsChosen: "Delete Me",
      credentialId: slug,
      issuedAt: "2026-10-17T10:00:00Z",
      revokedAt: null,
      revocationReason: null,
      scoreSnapshot: {},
    });

    expect(await repo.listCertificates(user)).toHaveLength(1);
    await repo.deleteUserData(user);
    expect(await repo.listCertificates(user)).toHaveLength(0);
    expect(await repo.verifyCertificate(slug)).toBeNull();
  });
});

describe("learner GDPR export allowlist for certificates", () => {
  it("includes certificates in export with only safe public/score fields", async () => {
    const repo = new MemoryProgressRepo();
    const ctx = { repo } as unknown as Ctx;
    const user = "u-export-user";
    const slug = generateCredentialId();

    await repo.saveCertificate({
      userId: user,
      trackId: "core",
      level: "Operator",
      nameAsChosen: "Casey Operative",
      credentialId: slug,
      issuedAt: "2026-10-17T10:00:00Z",
      revokedAt: null,
      revocationReason: null,
      scoreSnapshot: { rank: 1, challengeRank: 0 },
    });

    const exportData = await buildLearnerExport(ctx, user, {} as any);
    expect(exportData.certificates).toHaveLength(1);
    expect(exportData.certificates[0]).toEqual({
      credentialId: slug,
      trackId: "core",
      level: "Operator",
      nameAsChosen: "Casey Operative",
      issuedAt: "2026-10-17T10:00:00Z",
      status: "valid",
      revokedAt: null,
      scoreSnapshot: { rank: 1, challengeRank: 0 },
    });

    expect((exportData.certificates[0] as any).userId).toBeUndefined();
    expect((exportData.certificates[0] as any).id).toBeUndefined();
  });
});
