import { describe, expect, it } from "vitest";
import { formatGetItem, formatItemProperty, getRegistryKey, normalizeRegPath } from "@/lib/lab-engine/terminal/windows/registry";

describe("Windows Registry helpers", () => {
  it("normalizes diverse registry path variations", () => {
    expect(normalizeRegPath("HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run")).toBe(
      "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
    );
    expect(normalizeRegPath("hklm:/software/microsoft/windows/currentversion/run/")).toBe(
      "HKLM:\\software\\microsoft\\windows\\currentversion\\run",
    );
    expect(normalizeRegPath("HKEY_LOCAL_MACHINE\\SOFTWARE\\Test")).toBe("HKLM:\\SOFTWARE\\Test");
    expect(normalizeRegPath("HKCU:/SOFTWARE/Test")).toBe("HKCU:\\SOFTWARE\\Test");
  });

  it("retrieves registry keys case-insensitively", () => {
    const hive = {
      "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run": {
        SecurityHealth: "C:\\Windows\\system32\\SecurityHealthSystray.exe",
        Updater: "C:\\Users\\public\\update.exe",
      },
    };

    const found = getRegistryKey(hive, "hklm:/software/microsoft/windows/currentversion/run");
    expect(found).not.toBeNull();
    expect(found?.values.Updater).toBe("C:\\Users\\public\\update.exe");

    const missing = getRegistryKey(hive, "HKLM:\\SOFTWARE\\NonExistent");
    expect(missing).toBeNull();
  });

  it("formats Get-ItemProperty and Get-Item outputs accurately", () => {
    const values = {
      SecurityHealth: "C:\\Windows\\system32\\SecurityHealthSystray.exe",
    };
    const gpOutput = formatItemProperty("HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", values);
    expect(gpOutput).toContain("SecurityHealth");
    expect(gpOutput).toContain("PSPath");
    expect(gpOutput).toContain("PSChildName");

    const giOutput = formatGetItem("HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", values);
    expect(giOutput).toContain("Hive: HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion");
    expect(giOutput).toContain("Run");
  });
});
