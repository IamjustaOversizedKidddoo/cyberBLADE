# Cloud Security Track Roadmap

**Status:** Owner decision 2026-10-07 — source is the owner's CLOUD-SECURITY-journal: https://github.com/IamjustaOversizedKidddoo/CLOUD-SECURITY-journal ("90-day Zero to Job Ready", target role Cloud Security Engineer / DevSecOps Engineer, 3 phases, 5 deliverables). Platform: AWS-first.
**Benchmarks to exceed (spec §4.2):** AWS Certified Security – Specialty, CCSK, CCSP (cloud domains).
**Prerequisite:** shared core (Rank 0 + Ranks 1–2). The journal's Week 1 networking/Linux material is already taught in the core, so the track opens with a short cloud on-ramp and moves straight to AWS.

Legend: **[repo]** = taken from the journal as written. **[derived]** = the journal names only the focus area; topics filled in to complete it (owner/reviewer to confirm).

## Labs in v1 (no per-learner cloud accounts — spec §1, §7)

- `cloud` lab type: mock AWS-style console + JSON account state + IAM policy evaluator (allow/deny with conditions, explicit deny, SCP-style boundaries), mock S3/EC2/VPC/CloudTrail/GuardDuty data from seeded generators.
- IaC review labs: learner reads/fixes Terraform and the platform checks the resulting config with the same evaluator (no `terraform apply`).
- Python/Boto3 work: scripts run against a simulated SDK over the mock account state (no real AWS calls).
- Optional "do it for real" sidebars for learners with their own AWS free tier, with cost and cleanup warnings. Real cloud sandboxes = v2 (spec §7.3).

---

## Phase C1 — Cloud foundations, AWS core & automation (journal Days 1–30)

| Week | Topic | Contents |
|---|---|---|
| C1 | Cloud on-ramp [repo, condensed] | Recap of core TCP/IP, subnetting, TLS, Linux permissions/audit logs/SSH hardening in a cloud context · Git architecture, commit signing, SSH keys, PR workflows · Provisioning an Ubuntu server in AWS, network diagnostic tooling (tcpdump, curl, dig, nmap) |
| C2 | AWS core security [repo] | AWS global infrastructure (regions, AZs) · shared responsibility model [derived] · IAM users, access keys and their risks · baseline security controls · EC2 security hardening · S3 public access prevention (Block Public Access, bucket policies) |
| C3 | IAM deep dive [repo] | IAM policy structure · evaluation logic (explicit deny > allow > implicit deny) · conditions · MFA enforcement · roles and temporary credentials [derived] · least privilege [derived] |
| C4 | Python security automation [repo] | Requests, JSON, OS interaction · Boto3 · automated AWS auditing (public buckets, unused keys, open security groups, missing MFA) |
| C5 | Cloud networking [repo] | Custom VPC · subnets (public/private) · route tables · NAT gateways · security groups vs NACLs · bastion hosts vs SSM Session Manager |
| C6 | Infrastructure-as-Code [repo] | Terraform HCL architecture · providers · remote state (and why state is sensitive) · production multi-tier VPC deployment · security architecture validation · documentation |

**Deliverables:** (1) Automated port scanner script (Python) · (2) AWS security auditor (Boto3) · (3) Multi-tier production VPC (Terraform).

## Phase C2 — Cloud defense & security services (journal Days 31–60)

| Week | Topic | Contents |
|---|---|---|
| C7 | Encryption & keys [repo: KMS] | KMS keys and key policies · envelope encryption · encryption at rest/in transit · secrets management (Secrets Manager / Parameter Store) [derived] |
| C8 | Logging & detection services [repo: CloudTrail, GuardDuty, Config, Security Hub] | CloudTrail events and what attackers hide · AWS Config rules and drift · GuardDuty findings and triage · Security Hub aggregation and standards |
| C9 | Edge protection [repo: WAF] | AWS WAF rules, managed rule groups, rate limiting · mapping web attacks (core Rank 2) to WAF detections [derived] |
| C10 | Container security [repo: Docker hardening, Trivy] | Docker image and runtime hardening · image scanning with Trivy · container/Kubernetes security basics [derived] |
| C11 | DevSecOps pipelines [repo: GitHub Actions, SAST/SCA] | CI/CD on GitHub Actions · SAST and SCA · secrets scanning [derived] · pipeline/supply-chain risks (over-privileged CI roles, OIDC to AWS) [derived] |
| C12 | Cloud attack paths [derived] | Leaked keys → enumeration → privilege escalation via IAM misconfig → data exfiltration from S3 · mapping to MITRE ATT&CK cloud techniques · the defender view for each step |

**Deliverable:** (4) DevSecOps CI/CD security pipeline.

## Phase C3 — SIEM, cloud incident response, capstone (journal Days 61–90)

| Week | Topic | Contents |
|---|---|---|
| C13 | Cloud SIEM & SOC automation [repo] | Wazuh/Splunk ingestion of CloudTrail and VPC Flow Logs · custom detection rules · alert tuning |
| C14 | Auto-remediation & cloud IR [repo: Lambda auto-remediation] | Lambda-based auto-remediation (e.g. close a public bucket, disable a leaked key) · cloud incident response lifecycle · evidence preservation in cloud [derived] |
| C15 | CSPM & compliance [derived — spec §6] | CSPM concepts · CIS AWS Foundations-style checks · mapping findings to controls |
| C16 | Capstone + interview prep [repo: "Capstone & Hiring Blitz"] | Breach-and-fix capstone (spec §5.2) · architecture review report · portfolio and interview practice (Handler `interview` mode) |

**Deliverable:** (5) Automated cloud incident detection & response system.

**Track exam (spec §5.2):** breach-and-fix of a misconfigured mock cloud org + an architecture review report → track certificate + `/verify` page.
