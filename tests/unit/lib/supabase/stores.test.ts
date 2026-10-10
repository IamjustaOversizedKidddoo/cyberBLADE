import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { SupabaseOperatorStore } from "@/lib/identity/supabase-operator-store";
import { SupabaseProgressRepo } from "@/lib/progress/supabase-repo";
import * as serverModule from "@/lib/supabase/server";
import * as adminModule from "@/lib/supabase/admin";

describe("Supabase Stores & Adapters", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("SupabaseOperatorStore", () => {
    it("retrieves operator profile mapped from snake_case", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "user-123",
          handle: "ghost_operator",
          rank: 2,
          ethics_accepted_at: "2026-10-10T12:00:00Z",
          created_at: "2026-10-10T12:00:00Z",
        },
        error: null,
      });

      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mockSingle,
            }),
          }),
        }),
      };

      vi.spyOn(serverModule, "createServerSupabaseClient").mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverModule.createServerSupabaseClient>>
      );

      const store = new SupabaseOperatorStore();
      const op = await store.get("user-123");

      expect(op).not.toBeNull();
      expect(op?.id).toBe("user-123");
      expect(op?.handle).toBe("ghost_operator");
      expect(op?.rank).toBe(2);
      expect(op?.ethicsAcceptedAt).toBe("2026-10-10T12:00:00Z");
    });

    it("returns null when operator record is not found", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mockSingle,
            }),
          }),
        }),
      };

      vi.spyOn(serverModule, "createServerSupabaseClient").mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverModule.createServerSupabaseClient>>
      );

      const store = new SupabaseOperatorStore();
      const op = await store.get("non-existent");
      expect(op).toBeNull();
    });

    it("creates an operator record", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "new-op-456",
          handle: "shadow_runner",
          rank: 0,
          ethics_accepted_at: "2026-10-10T14:00:00Z",
          created_at: "2026-10-10T14:00:00Z",
        },
        error: null,
      });

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      };

      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(
        mockClient as unknown as ReturnType<typeof adminModule.createAdminClient>
      );
      vi.spyOn(serverModule, "createServerSupabaseClient").mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverModule.createServerSupabaseClient>>
      );

      const store = new SupabaseOperatorStore();
      const op = await store.create({
        id: "new-op-456",
        handle: "shadow_runner",
        ethicsAcceptedAt: "2026-10-10T14:00:00Z",
      });

      expect(op.id).toBe("new-op-456");
      expect(op.handle).toBe("shadow_runner");
      expect(op.rank).toBe(0);
    });

    it("updates operator rank", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: mockEq,
          }),
        }),
      };

      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(
        mockClient as unknown as ReturnType<typeof adminModule.createAdminClient>
      );
      vi.spyOn(serverModule, "createServerSupabaseClient").mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof serverModule.createServerSupabaseClient>>
      );

      const store = new SupabaseOperatorStore();
      await expect(store.setRank("user-123", 3)).resolves.not.toThrow();
      expect(mockEq).toHaveBeenCalledWith("id", "user-123");
    });
  });

  describe("SupabaseProgressRepo", () => {
    it("retrieves lesson progress correctly", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          user_id: "user-1",
          lesson_id: "core-r0-terminal-01",
          status: "completed",
          checks_passed: ["q1", "q2"],
          completed_at: "2026-10-10T15:00:00Z",
        },
        error: null,
      });

      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockSingle,
              }),
            }),
          }),
        }),
      };

      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(
        mockClient as unknown as ReturnType<typeof adminModule.createAdminClient>
      );

      const repo = new SupabaseProgressRepo();
      const progress = await repo.getLessonProgress("user-1", "core-r0-terminal-01");

      expect(progress).not.toBeNull();
      expect(progress?.userId).toBe("user-1");
      expect(progress?.lessonId).toBe("core-r0-terminal-01");
      expect(progress?.status).toBe("completed");
      expect(progress?.checksPassed).toEqual(["q1", "q2"]);
    });

    it("awards XP and handles duplicate source idempotency", async () => {
      const mockInsertSuccess = vi.fn().mockResolvedValue({ error: null });
      const mockClientSuccess = {
        from: vi.fn().mockReturnValue({
          insert: mockInsertSuccess,
        }),
      };

      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(
        mockClientSuccess as unknown as ReturnType<typeof adminModule.createAdminClient>
      );

      const repo = new SupabaseProgressRepo();
      const awarded = await repo.awardXp("user-1", "lesson:test", 100);
      expect(awarded).toBe(true);

      // Duplicate insert error (code 23505)
      const mockInsertDuplicate = vi.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });
      const mockClientDuplicate = {
        from: vi.fn().mockReturnValue({
          insert: mockInsertDuplicate,
        }),
      };

      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(
        mockClientDuplicate as unknown as ReturnType<typeof adminModule.createAdminClient>
      );
      const duplicateAward = await repo.awardXp("user-1", "lesson:test", 100);
      expect(duplicateAward).toBe(false);
    });
  });
});
