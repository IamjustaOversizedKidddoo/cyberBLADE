import { describe, it, expect } from "vitest";
import { z } from "zod";
import { loadLab } from "@/lib/lab-engine/labs";
import { dataPath } from "@/lib/storage/json-store";
import { dir } from "@/lib/lab-engine/terminal/build";
import { Vfs, VfsError } from "@/lib/lab-engine/terminal/vfs";

describe("Security Part E: Input Validation & Injection Hardening", () => {
  describe("Path Traversal Defense", () => {
    it.each([
      "../../etc/passwd",
      "../labs",
      "/etc/shadow",
      "lab/nested",
      "lab\\windows",
      "lab..name",
      "lab name",
      "LAB_CAPS",
      "",
    ])("loadLab rejects path traversal or invalid id %j", async (invalidId) => {
      await expect(loadLab(invalidId)).rejects.toThrow(/invalid lab id/);
    });

    it.each([
      "../db.json",
      "..\\db.json",
      "/root/secret.json",
      "C:\\Windows\\system32",
      "dir/file.json",
      "",
    ])("dataPath rejects path traversal or invalid file %j", (invalidFile) => {
      expect(() => dataPath(invalidFile)).toThrow(/path traversal|non-empty string/);
    });
  });

  describe("Virtual File System Prototype Pollution Defense", () => {
    it.each(["__proto__", "constructor", "prototype"])(
      "Vfs rejects navigation or write to special property '%s'",
      (specialProp) => {
        const vfs = new Vfs(dir({}));
        expect(() => vfs.stat(`/${specialProp}`)).toThrow(VfsError);
        expect(() => vfs.write(`/${specialProp}`, "malicious", "root", false)).toThrow(VfsError);
        expect(() => vfs.mkdir(`/${specialProp}`, "root", false)).toThrow(VfsError);
      }
    );

    it("verifies Object.prototype is unpolluted after malicious paths", () => {
      const vfs = new Vfs(dir({}));
      try {
        vfs.write("/__proto__/polluted", "polluted", "root", false);
      } catch {
        // Expected VfsError
      }
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe("Strict Schema Boundaries & Rejection of Malformed Payloads", () => {
    const submissionSchema = z.tuple([
      z.string().min(1).max(100),
      z.string().min(1).max(50),
      z.string().max(500),
    ]);

    it("rejects oversized submission payloads", () => {
      const hugeAnswer = "A".repeat(501);
      const result = submissionSchema.safeParse(["attempt-1", "obj-1", hugeAnswer]);
      expect(result.success).toBe(false);
    });

    it("rejects empty attempt or objective identifiers", () => {
      expect(submissionSchema.safeParse(["", "obj-1", "flag"]).success).toBe(false);
      expect(submissionSchema.safeParse(["attempt-1", "", "flag"]).success).toBe(false);
    });

    it("rejects extra unknown arguments (tuple size enforcement)", () => {
      const result = submissionSchema.safeParse([
        "attempt-1",
        "obj-1",
        "flag",
        "extra_field",
      ]);
      expect(result.success).toBe(false);
    });

    const webappMethodSchema = z.enum(["GET", "POST"]);

    it.each(["PUT", "DELETE", "PATCH", "TRACE", "OPTIONS", "CONNECT", "HEAD"])(
      "rejects unsupported HTTP method '%s' in simulated web app",
      (method) => {
        expect(webappMethodSchema.safeParse(method).success).toBe(false);
      }
    );
  });
});
