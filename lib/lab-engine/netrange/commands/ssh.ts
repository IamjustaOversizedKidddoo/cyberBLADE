import type { NetRangeScenario, NetRangeSession, NetRangeState } from "../types";
import { findHostByIpOrName, formatPrompt, isTargetRoutable } from "./util";

export function execSsh(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState; prompt?: string } {
  let targetSpec = "";
  let userOverride = "";
  let port = 22;
  let remoteCmd = "";

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" && i + 1 < argv.length) {
      port = Number(argv[++i]);
    } else if (a === "-l" && i + 1 < argv.length) {
      userOverride = argv[++i];
    } else if (!a.startsWith("-")) {
      if (!targetSpec) {
        targetSpec = a;
      } else {
        remoteCmd = argv.slice(i).join(" ");
        break;
      }
    }
  }

  if (!targetSpec) {
    return { stdout: "", stderr: "usage: ssh [-p port] [user@]hostname [command]\n", code: 1 };
  }

  let username = userOverride;
  let hostPart = targetSpec;
  if (targetSpec.includes("@")) {
    const [u, h] = targetSpec.split("@");
    username = u;
    hostPart = h;
  }

  if (!username) {
    username = "root";
  }

  const host = findHostByIpOrName(scenario, hostPart);
  if (!host) {
    return { stdout: "", stderr: `ssh: Could not resolve hostname ${hostPart}: Name or service not known\n`, code: 255 };
  }

  const iface = host.interfaces.find((i) => i.ip === hostPart) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return { stdout: "", stderr: `ssh: connect to host ${iface.ip} port ${port}: Network is unreachable\n`, code: 255 };
  }

  const sshSvc = host.services.find((s) => s.port === port || s.name === "ssh");
  if (!sshSvc) {
    return { stdout: "", stderr: `ssh: connect to host ${iface.ip} port ${port}: Connection refused\n`, code: 255 };
  }

  const userAccount = host.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );

  if (!userAccount) {
    return { stdout: "", stderr: `${username}@${iface.ip}: Permission denied (publickey,password).\n`, code: 1 };
  }

  // Create or switch to session
  const newSessionId = (state.sessions.length > 0 ? Math.max(...state.sessions.map((s) => s.id)) : 0) + 1;
  const newSession: NetRangeSession = {
    id: newSessionId,
    hostId: host.id,
    user: userAccount.username,
    type: "ssh",
    openedAt: "2026-10-17T12:00:00Z",
  };

  const initialCwd = host.os === "windows" ? `C:\\Users\\${userAccount.username}` : `/home/${userAccount.username}`;

  const nextState: NetRangeState = {
    ...state,
    currentHostId: host.id,
    currentUser: userAccount.username,
    currentCwd: initialCwd,
    sessions: [...state.sessions, newSession],
    activeSessionId: newSessionId,
  };

  if (remoteCmd) {
    // If executing a one-off remote command, execute and return without persisting session
    const out = `Executing remote command: ${remoteCmd}\n`;
    return { stdout: out, stderr: "", code: 0 };
  }

  const motd = `
Welcome to ${host.hostname} (${host.os === "windows" ? "Windows Server" : "Ubuntu Linux 20.04.4 LTS"}).
 * Documentation:  https://help.example.com
 * Support:        https://support.example.com

Last login: Sat Oct 17 11:59:12 2026 from 192.0.2.200
`;

  return {
    stdout: motd.trim() + "\n",
    stderr: "",
    code: 0,
    nextState,
    prompt: formatPrompt(nextState, scenario),
  };
}
