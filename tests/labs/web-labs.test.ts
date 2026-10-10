import { describe, expect, it } from "vitest";
import { sqliLab } from "@/lib/generators/webapp/sqli-lab";
import { xssLab } from "@/lib/generators/webapp/xss-lab";
import { idorLab } from "@/lib/generators/webapp/idor-lab";
import { r2Challenge } from "@/lib/generators/webapp/r2-challenge";
import { createRng } from "@/lib/generators/rng";

describe("Phase 2F WebApp Lab Generators Property Tests", () => {
  it("generates deterministic and valid flags across 1,000 seeds for sqliLab", () => {
    for (let i = 0; i < 1000; i++) {
      const seed = `sqli-seed-${i}`;
      const out1 = sqliLab(createRng(seed), {});
      const out2 = sqliLab(createRng(seed), {});

      // Determinism
      expect(out1.answers.flag_auth).toBe(out2.answers.flag_auth);
      expect(out1.answers.flag_union).toBe(out2.answers.flag_union);

      // Flag syntax
      expect(out1.answers.flag_auth).toMatch(/^CYBERBLADE\{sqli_auth_[0-9a-f]{8}\}$/);
      expect(out1.answers.flag_union).toMatch(/^CYBERBLADE\{sqli_union_[0-9a-f]{8}\}$/);
    }
  });

  it("generates deterministic and valid flags across 1,000 seeds for xssLab", () => {
    for (let i = 0; i < 1000; i++) {
      const seed = `xss-seed-${i}`;
      const out1 = xssLab(createRng(seed), {});
      const out2 = xssLab(createRng(seed), {});

      // Determinism
      expect(out1.answers.flag_cookie).toBe(out2.answers.flag_cookie);
      expect(out1.answers.admin_cookie).toBe(out2.answers.admin_cookie);

      // Flag syntax
      expect(out1.answers.flag_cookie).toMatch(/^CYBERBLADE\{xss_stealer_[0-9a-f]{8}\}$/);
      expect(out1.answers.admin_cookie).toMatch(/^adm_session_[0-9a-f]{12}$/);
    }
  });

  it("generates deterministic and valid flags across 1,000 seeds for idorLab", () => {
    for (let i = 0; i < 1000; i++) {
      const seed = `idor-seed-${i}`;
      const out1 = idorLab(createRng(seed), {});
      const out2 = idorLab(createRng(seed), {});

      // Determinism
      expect(out1.answers.flag_profile).toBe(out2.answers.flag_profile);
      expect(out1.answers.flag_invoice).toBe(out2.answers.flag_invoice);

      // Flag syntax
      expect(out1.answers.flag_profile).toMatch(/^CYBERBLADE\{idor_ciso_[0-9a-f]{8}\}$/);
      expect(out1.answers.flag_invoice).toMatch(/^CYBERBLADE\{idor_inv_[0-9a-f]{8}\}$/);
    }
  });

  it("generates deterministic and valid flags across 1,000 seeds for r2Challenge", () => {
    for (let i = 0; i < 1000; i++) {
      const seed = `r2c-seed-${i}`;
      const out1 = r2Challenge(createRng(seed), {});
      const out2 = r2Challenge(createRng(seed), {});

      // Determinism
      expect(out1.answers.flag_idor).toBe(out2.answers.flag_idor);
      expect(out1.answers.flag_sqli).toBe(out2.answers.flag_sqli);
      expect(out1.answers.flag_root).toBe(out2.answers.flag_root);

      // Flag syntax
      expect(out1.answers.flag_idor).toMatch(/^CYBERBLADE\{watchtower_idor_[0-9a-f]{8}\}$/);
      expect(out1.answers.flag_sqli).toMatch(/^CYBERBLADE\{watchtower_sqli_[0-9a-f]{8}\}$/);
      expect(out1.answers.flag_root).toMatch(/^CYBERBLADE\{watchtower_root_[0-9a-f]{8}\}$/);
    }
  });
});
