/**
 * Log Format Modules for CyberBLADE SOC Scenario Generation
 * Single source of truth for realistic, synthetically consistent telemetry across all scenario families.
 * Formats match enterprise technologies (Email Gateway, Proxy/DNS, Firewall, Windows Event Log,
 * Linux auth.log/syslog, Nginx/Apache Combined, IdP/VPN, CloudTrail, EDR).
 */

export type EmailGatewayLogParams = {
  timestamp: string;
  sender: string;
  recipient: string;
  clientIp: string;
  subject: string;
  spfResult: "pass" | "fail" | "softfail" | "none";
  dkimResult: "pass" | "fail" | "none";
  dmarcVerdict: "pass" | "fail" | "none";
  extractedUrls?: string[];
  attachments?: string[];
  verdict: "delivered" | "quarantined" | "rejected";
  spamScore?: number;
};

export type ProxyDnsLogParams = {
  timestamp: string;
  clientIp: string;
  query: string;
  recordType?: "A" | "AAAA" | "TXT" | "CNAME" | "MX";
  responseCode?: "NOERROR" | "NXDOMAIN" | "SERVFAIL";
  resolvedIps?: string[];
  method?: "GET" | "POST" | "CONNECT";
  url?: string;
  bytesReceived?: number;
  userAgent?: string;
};

export type FirewallFlowLogParams = {
  timestamp: string;
  action: "ALLOW" | "DENY";
  protocol: "TCP" | "UDP" | "ICMP";
  srcIp: string;
  srcPort: number;
  dstIp: string;
  dstPort: number;
  bytesSent: number;
  bytesReceived: number;
  packets: number;
  ruleName: string;
};

export type WindowsSecurityLogParams = {
  timestamp: string;
  eventId: 4624 | 4625 | 4688 | 7045;
  computer: string;
  userName?: string;
  domain?: string;
  logonType?: 2 | 3 | 10;
  ipAddress?: string;
  ipPort?: number;
  status?: string;
  subStatus?: string;
  newProcessName?: string;
  commandLine?: string;
  parentProcessName?: string;
  serviceName?: string;
  serviceFileName?: string;
  serviceAccount?: string;
};

export type LinuxAuthLogParams = {
  timestamp: string;
  hostname: string;
  daemon: "sshd" | "sudo" | "su" | "CRON";
  pid?: number;
  action: "failed_password" | "accepted_password" | "sudo_command" | "cron_job";
  user: string;
  sourceIp?: string;
  sourcePort?: number;
  command?: string;
};

export type WebServerAccessLogParams = {
  timestamp: string;
  clientIp: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  uri: string;
  httpVersion?: string;
  statusCode: number;
  bytesSent: number;
  referer?: string;
  userAgent?: string;
};

export type VpnIdpLogParams = {
  timestamp: string;
  userPrincipal: string;
  event: "login_success" | "login_failed" | "mfa_prompt" | "mfa_approved" | "mfa_denied";
  clientIp: string;
  locationCity?: string;
  locationCountry?: string;
  asn?: string;
  deviceCompliant?: boolean;
  mfaMethod?: "push_notification" | "fido2" | "totp" | "sms";
  userAgent?: string;
};

export type CloudAuditLogParams = {
  timestamp: string;
  eventName: "CreateAccessKey" | "AttachUserPolicy" | "ConsoleLogin" | "RunInstances" | "PutBucketPolicy";
  eventSource: string;
  callerIdentity: string;
  callerType: "IAMUser" | "AssumedRole" | "FederatedUser";
  sourceIp: string;
  userAgent?: string;
  requestParameters: Record<string, unknown>;
  responseElements?: Record<string, unknown>;
};

export type EdrTelemetryParams = {
  timestamp: string;
  hostName: string;
  eventType: "process_creation" | "file_modification" | "registry_set_value" | "network_connection";
  processName: string;
  processPath: string;
  commandLine?: string;
  parentProcess?: string;
  sha256?: string;
  targetPath?: string;
  destIp?: string;
  destPort?: number;
};

/**
 * Log Generators
 */

export function generateEmailGatewayLog(p: EmailGatewayLogParams) {
  const urlStr = p.extractedUrls?.join(",") ?? "none";
  const attachStr = p.attachments?.join(",") ?? "none";
  const message = `MTA[gateway]: Message from <${p.sender}> to <${p.recipient}> [SPF:${p.spfResult.toUpperCase()}, DKIM:${p.dkimResult.toUpperCase()}, DMARC:${p.dmarcVerdict.toUpperCase()}]: verdict=${p.verdict} subject="${p.subject}"`;
  return {
    source: "EmailGateway",
    action: `email_${p.verdict}`,
    message,
    fields: {
      timestamp: p.timestamp,
      sender: p.sender,
      recipient: p.recipient,
      client_ip: p.clientIp,
      subject: p.subject,
      spf_result: p.spfResult,
      dkim_result: p.dkimResult,
      dmarc_verdict: p.dmarcVerdict,
      extracted_urls: urlStr,
      attachments: attachStr,
      verdict: p.verdict,
      spam_score: p.spamScore ?? 0.05,
    },
  };
}

export function generateProxyDnsLog(p: ProxyDnsLogParams) {
  const record = p.recordType ?? "A";
  const rcode = p.responseCode ?? "NOERROR";
  const resolved = p.resolvedIps?.join(",") ?? "none";
  const message = `DNS[resolver]: query=${p.query} type=${record} rcode=${rcode} client=${p.clientIp} resolved=[${resolved}]`;
  return {
    source: "Network IDS",
    action: "dns_query",
    message,
    fields: {
      timestamp: p.timestamp,
      client_ip: p.clientIp,
      query: p.query,
      record_type: record,
      response_code: rcode,
      resolved_ips: resolved,
      method: p.method ?? "GET",
      url: p.url ?? `http://${p.query}/`,
      bytes_received: p.bytesReceived ?? 1024,
      user_agent: p.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  };
}

export function generateFirewallFlowLog(p: FirewallFlowLogParams) {
  const message = `FW[edge]: ${p.action} ${p.protocol} ${p.srcIp}:${p.srcPort} -> ${p.dstIp}:${p.dstPort} rule="${p.ruleName}" bytes=${p.bytesSent + p.bytesReceived}`;
  return {
    source: "Firewall",
    action: `flow_${p.action.toLowerCase()}`,
    message,
    fields: {
      timestamp: p.timestamp,
      action: p.action,
      protocol: p.protocol,
      src_ip: p.srcIp,
      src_port: p.srcPort,
      dst_ip: p.dstIp,
      dst_port: p.dstPort,
      bytes_sent: p.bytesSent,
      bytes_received: p.bytesReceived,
      packets: p.packets,
      rule_name: p.ruleName,
    },
  };
}

export function generateWindowsSecurityLog(p: WindowsSecurityLogParams) {
  let action = "event_unknown";
  let message = "";
  const fields: Record<string, string | number | boolean> = {
    timestamp: p.timestamp,
    event_id: p.eventId,
    computer: p.computer,
  };

  switch (p.eventId) {
    case 4624:
      action = "successful_logon";
      message = `Microsoft-Windows-Security-Auditing: An account was successfully logged on. Account Name: ${p.userName ?? "SYSTEM"}, Logon Type: ${p.logonType ?? 3}, Source Network Address: ${p.ipAddress ?? "127.0.0.1"}`;
      fields.user_name = p.userName ?? "SYSTEM";
      fields.logon_type = p.logonType ?? 3;
      fields.ip_address = p.ipAddress ?? "127.0.0.1";
      fields.ip_port = p.ipPort ?? 0;
      break;
    case 4625:
      action = "failed_logon";
      message = `Microsoft-Windows-Security-Auditing: An account failed to log on. Account Name: ${p.userName ?? "unknown"}, Failure Reason: Unknown user name or bad password, Sub Status: ${p.subStatus ?? "0xC000006A"}`;
      fields.user_name = p.userName ?? "unknown";
      fields.failure_reason = "BadPassword";
      fields.sub_status = p.subStatus ?? "0xC000006A";
      fields.ip_address = p.ipAddress ?? "127.0.0.1";
      break;
    case 4688:
      action = "process_creation";
      message = `Microsoft-Windows-Security-Auditing: A new process has been created. Creator Subject: ${p.userName ?? "SYSTEM"}, New Process: ${p.newProcessName}, CommandLine: ${p.commandLine ?? ""}`;
      fields.creator_user = p.userName ?? "SYSTEM";
      fields.process_name = p.newProcessName ?? "cmd.exe";
      fields.command_line = p.commandLine ?? "";
      fields.parent_process = p.parentProcessName ?? "explorer.exe";
      break;
    case 7045:
      action = "service_installation";
      message = `Service Control Manager: A service was installed in the system. Service Name: ${p.serviceName}, Service File Name: ${p.serviceFileName}, Service Account: ${p.serviceAccount ?? "LocalSystem"}`;
      fields.service_name = p.serviceName ?? "ServiceHost";
      fields.service_file = p.serviceFileName ?? "C:\\Windows\\System32\\svchost.exe";
      fields.service_account = p.serviceAccount ?? "LocalSystem";
      break;
  }

  return {
    source: "Authentication",
    action,
    message,
    fields,
  };
}

export function generateLinuxAuthLog(p: LinuxAuthLogParams) {
  const pid = p.pid ?? 24190;
  let line = "";
  const actionStr = p.action;

  switch (p.action) {
    case "failed_password":
      line = `sshd[${pid}]: Failed password for ${p.user} from ${p.sourceIp ?? "127.0.0.1"} port ${p.sourcePort ?? 54321} ssh2`;
      break;
    case "accepted_password":
      line = `sshd[${pid}]: Accepted password for ${p.user} from ${p.sourceIp ?? "127.0.0.1"} port ${p.sourcePort ?? 54321} ssh2`;
      break;
    case "sudo_command":
      line = `sudo[${pid}]: ${p.user} : TTY=pts/0 ; PWD=/home/${p.user} ; USER=root ; COMMAND=${p.command ?? "/bin/bash"}`;
      break;
    case "cron_job":
      line = `CRON[${pid}]: (${p.user}) CMD (${p.command ?? "/usr/local/bin/backup.sh"})`;
      break;
  }

  const message = `${p.hostname} ${line}`;
  return {
    source: "Authentication",
    action: actionStr,
    message,
    fields: {
      timestamp: p.timestamp,
      hostname: p.hostname,
      daemon: p.daemon,
      user: p.user,
      source_ip: p.sourceIp ?? "127.0.0.1",
      source_port: p.sourcePort ?? 22,
      command: p.command ?? "none",
    },
  };
}

export function generateWebServerAccessLog(p: WebServerAccessLogParams) {
  const referer = p.referer ?? "-";
  const userAgent = p.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const message = `${p.clientIp} - - [${p.timestamp}] "${p.method} ${p.uri} HTTP/1.1" ${p.statusCode} ${p.bytesSent} "${referer}" "${userAgent}"`;

  return {
    source: "Network IDS",
    action: "http_request",
    message,
    fields: {
      timestamp: p.timestamp,
      client_ip: p.clientIp,
      method: p.method,
      uri: p.uri,
      status_code: p.statusCode,
      bytes_sent: p.bytesSent,
      referer,
      user_agent: userAgent,
    },
  };
}

export function generateVpnIdpLog(p: VpnIdpLogParams) {
  const message = `IdP[auth-service]: event=${p.event} user="${p.userPrincipal}" ip=${p.clientIp} city="${p.locationCity ?? "Chicago"}" country="${p.locationCountry ?? "US"}" mfa=${p.mfaMethod ?? "push_notification"} status=${p.event.includes("success") || p.event.includes("approved") ? "SUCCESS" : "FAILURE"}`;

  return {
    source: "Authentication",
    action: p.event,
    message,
    fields: {
      timestamp: p.timestamp,
      user: p.userPrincipal,
      event: p.event,
      client_ip: p.clientIp,
      location_city: p.locationCity ?? "Chicago",
      location_country: p.locationCountry ?? "US",
      asn: p.asn ?? "AS15169",
      device_compliant: p.deviceCompliant ?? true,
      mfa_method: p.mfaMethod ?? "push_notification",
    },
  };
}

export function generateCloudAuditLog(p: CloudAuditLogParams) {
  const message = `CloudTrail: eventSource="${p.eventSource}" eventName="${p.eventName}" caller="${p.callerIdentity}" callerType="${p.callerType}" sourceIP="${p.sourceIp}"`;

  return {
    source: "Authentication",
    action: p.eventName.toLowerCase(),
    message,
    fields: {
      timestamp: p.timestamp,
      event_source: p.eventSource,
      event_name: p.eventName,
      caller_identity: p.callerIdentity,
      caller_type: p.callerType,
      source_ip: p.sourceIp,
      request_parameters: JSON.stringify(p.requestParameters),
    },
  };
}

export function generateEdrTelemetry(p: EdrTelemetryParams) {
  const message = `EDR[sensor]: host=${p.hostName} type=${p.eventType} proc="${p.processName}" cmd="${p.commandLine ?? ""}" sha256=${p.sha256 ?? "none"}`;

  return {
    source: "EDR",
    action: p.eventType,
    message,
    fields: {
      timestamp: p.timestamp,
      hostname: p.hostName,
      event_type: p.eventType,
      process_name: p.processName,
      process_path: p.processPath,
      command_line: p.commandLine ?? "",
      parent_process: p.parentProcess ?? "none",
      sha256: p.sha256 ?? "none",
      target_path: p.targetPath ?? "none",
      dest_ip: p.destIp ?? "none",
      dest_port: p.destPort ?? 0,
    },
  };
}

/**
 * Golden Samples for Unit Testing & Realism Verification
 */
export const GOLDEN_LOG_SAMPLES = {
  emailDelivered: generateEmailGatewayLog({
    timestamp: "2026-10-12T08:15:22.000Z",
    sender: "billing@partner.example",
    recipient: "jdoe@apex.corp.internal",
    clientIp: "198.51.100.24",
    subject: "Vendor Invoice 40921",
    spfResult: "pass",
    dkimResult: "pass",
    dmarcVerdict: "pass",
    verdict: "delivered",
    spamScore: 0.02,
  }),
  proxyDnsQuery: generateProxyDnsLog({
    timestamp: "2026-10-12T08:16:04.000Z",
    clientIp: "10.10.1.45",
    query: "portal.invoice-secure.example",
    recordType: "A",
    responseCode: "NOERROR",
    resolvedIps: ["198.51.100.24"],
  }),
  firewallDeny: generateFirewallFlowLog({
    timestamp: "2026-10-12T08:17:11.000Z",
    action: "DENY",
    protocol: "TCP",
    srcIp: "203.0.113.15",
    srcPort: 52144,
    dstIp: "10.20.1.50",
    dstPort: 22,
    bytesSent: 64,
    bytesReceived: 0,
    packets: 1,
    ruleName: "DEFAULT_DROP_EXTERNAL",
  }),
  windowsLogonSuccess: generateWindowsSecurityLog({
    timestamp: "2026-10-12T08:18:00.000Z",
    eventId: 4624,
    computer: "ws-fin-01.apex.corp.internal",
    userName: "jdoe",
    logonType: 2,
    ipAddress: "127.0.0.1",
  }),
  windowsProcessCreate: generateWindowsSecurityLog({
    timestamp: "2026-10-12T08:19:00.000Z",
    eventId: 4688,
    computer: "ws-fin-01.apex.corp.internal",
    userName: "jdoe",
    newProcessName: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    commandLine: "powershell.exe -NoP -NonI -Exec Bypass -File C:\\ITAdmin\\Collect.ps1",
    parentProcessName: "C:\\Windows\\explorer.exe",
  }),
  linuxSshdAccepted: generateLinuxAuthLog({
    timestamp: "2026-10-12T08:20:00.000Z",
    hostname: "srv-stage-01.apex.corp.internal",
    daemon: "sshd",
    action: "accepted_password",
    user: "root",
    sourceIp: "198.51.100.45",
    sourcePort: 49210,
  }),
  webServerAccess: generateWebServerAccessLog({
    timestamp: "12/Oct/2026:08:21:00 +0000",
    clientIp: "198.51.100.89",
    method: "GET",
    uri: "/products?id=1%20UNION%20SELECT%20null,username,password%20FROM%20users--",
    statusCode: 200,
    bytesSent: 845210,
  }),
  vpnIdpLoginSuccess: generateVpnIdpLog({
    timestamp: "2026-10-12T08:22:00.000Z",
    userPrincipal: "jdoe@apex.corp.internal",
    event: "login_success",
    clientIp: "198.51.100.201",
    locationCity: "New York",
    locationCountry: "US",
  }),
  cloudAuditCreateKey: generateCloudAuditLog({
    timestamp: "2026-10-12T08:23:00.000Z",
    eventName: "CreateAccessKey",
    eventSource: "iam.amazonaws.com",
    callerIdentity: "dev-deployer",
    callerType: "IAMUser",
    sourceIp: "198.51.100.112",
    requestParameters: { userName: "backup-admin" },
  }),
};
