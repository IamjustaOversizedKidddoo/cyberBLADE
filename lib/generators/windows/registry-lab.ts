import type { RegistryHive } from "@/lib/lab-engine/terminal/windows/types";
import { formatFlag } from "../flag";
import type { Generator } from "../index";
import { pickWinHostname, windowsBaseWorld } from "../terminal/windows-world";

const SUSPICIOUS_RUN_KEYS = [
  { name: "OneDriveSyncUpdate", path: "C:\\Users\\Public\\svchost.exe" },
  { name: "WindowsDefenderHealth", path: "C:\\ProgramData\\updater.exe" },
  { name: "EdgeUpdaterService", path: "C:\\Users\\operator\\AppData\\Local\\Temp\\beacon.exe" },
  { name: "SecurityTaskTray", path: "C:\\Windows\\Temp\\rundll32.exe" },
  { name: "JavaUpdateScheduler", path: "C:\\Users\\Public\\Downloads\\client.exe" },
  { name: "ChromeUpdateAgent", path: "C:\\ProgramData\\Microsoft\\vaultsvc.exe" },
];

const SUSPICIOUS_SERVICES = [
  { name: "W32NetSvc", imagePath: "C:\\Windows\\Temp\\netmon.exe", desc: "Network Monitor Helper Service" },
  { name: "SysTelemetryAgent", imagePath: "C:\\ProgramData\\telemetry.exe", desc: "System Telemetry Collection" },
  { name: "RpcHealthProbe", imagePath: "C:\\Users\\Public\\rpcprobe.exe", desc: "RPC Health Assessment Service" },
  { name: "WinSecurityHelper", imagePath: "C:\\ProgramData\\sechelper.exe", desc: "Windows Security Support Service" },
];

export const registryLab: Generator = (rng) => {
  const hostname = pickWinHostname(rng);
  const pickedRun = rng.pick(SUSPICIOUS_RUN_KEYS);
  const pickedService = rng.pick(SUSPICIOUS_SERVICES);
  const labFlag = formatFlag(rng.hex(12));

  const registry: RegistryHive = {
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run": {
      SecurityHealth: "C:\\Windows\\System32\\SecurityHealthSystray.exe",
      OneDriveSetup: "C:\\Windows\\System32\\OneDriveSetup.exe /thfirstsetup",
      [pickedRun.name]: pickedRun.path,
    },
    "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion": {
      ProductName: "Windows 11 Enterprise",
      CurrentVersion: "6.3",
      CurrentBuild: "22631",
      ReleaseId: "23H2",
    },
    [`HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${pickedService.name}`]: {
      DisplayName: pickedService.desc,
      ImagePath: pickedService.imagePath,
      Start: "2",
      Type: "16",
    },
    "HKLM:\\SOFTWARE\\CyberBlade\\Audit": {
      InspectionId: "AUDIT-2026-WIN01",
      Flag: labFlag,
      Status: "ACTIVE",
    },
  };

  const world = windowsBaseWorld({
    hostname,
    user: "operator",
    registry,
  });

  return {
    env: { kind: "terminal", world },
    answers: {
      runKeyName: pickedRun.name,
      runBinaryPath: pickedRun.path,
      serviceImagePath: pickedService.imagePath,
      flag: labFlag,
    },
  };
};
