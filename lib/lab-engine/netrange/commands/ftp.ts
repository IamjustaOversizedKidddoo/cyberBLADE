import type { NetRangeScenario, NetRangeState } from "../types";
import { findHostByIpOrName, isTargetRoutable } from "./util";

export function execFtp(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState } {
  const target = argv.find((a) => !a.startsWith("-") && a !== "ftp");
  if (!target) {
    return { stdout: "", stderr: "usage: ftp host [port]\n", code: 1 };
  }

  const host = findHostByIpOrName(scenario, target);
  if (!host) {
    return { stdout: "", stderr: `ftp: Could not resolve hostname ${target}: Name or service not known\n`, code: 1 };
  }

  const iface = host.interfaces.find((i) => i.ip === target) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return { stdout: "", stderr: `ftp: connect to address ${iface.ip}: Network is unreachable\n`, code: 1 };
  }

  const ftpSvc = host.services.find((s) => s.port === 21 || s.name === "ftp");
  if (!ftpSvc) {
    return { stdout: "", stderr: `ftp: connect to address ${iface.ip}: Connection refused\n`, code: 1 };
  }

  const banner = ftpSvc.banner ?? `220 (${ftpSvc.version ?? "vsftpd 2.3.4"})`;
  const ftpData = ftpSvc.ftpData ?? {
    anon: true,
    files: {
      "README.txt": "Public FTP download area. Welcome.\n",
    },
  };

  const files = ftpData.files ?? {};
  const fileLines = Object.entries(files)
    .map(([name, content]) => `-rw-r--r-- 1 ftp ftp ${content.length} Oct 17 11:58 ${name}`)
    .join("\n");

  const nextState = { ...state };
  for (const [name, content] of Object.entries(files)) {
    nextState.downloadedFiles[name] = content;
  }

  const out = `
Connected to ${iface.ip}.
${banner}
Name (${iface.ip}:kali): anonymous
331 Please specify the password.
Password:
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls
200 PORT command successful. Consider using PASV.
150 Here comes the directory listing.
${fileLines}
226 Directory send OK.
ftp> bye
221 Goodbye.
`;

  return { stdout: out.trim() + "\n", stderr: "", code: 0, nextState };
}
