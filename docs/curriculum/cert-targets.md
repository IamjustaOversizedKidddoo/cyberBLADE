# Certification Targets

**Status:** Owner decision 2026-10-07 — every track teaches toward *all* the major paid certifications of its field. Each listed cert must reach **100% objective coverage** (spec §5.5) before its track is called exam-ready.

**Before building a cert's prep:** download the *current* official exam objectives/syllabus page, record the exam version, question count, time limit and format in `content/certs/<cert-id>.yaml`, and re-check on every quarterly review (versions change — e.g. CompTIA retires exam codes every ~3 years). Values below are format types only; exact numbers come from the official page at build time.

Legend — format: **MCQ** multiple choice · **PBQ** performance-based simulation questions · **Practical** hands-on lab exam · **Report** written report graded.

## Shared core (everyone)

| Cert | Vendor | Format | Notes |
|---|---|---|---|
| A+ (security-relevant objectives) | CompTIA | MCQ + PBQ | Only security/OS/networking objectives targeted |
| Network+ | CompTIA | MCQ + PBQ | |
| Security+ | CompTIA | MCQ + PBQ | Most-requested entry cert in Indian job posts |
| Certified in Cybersecurity (CC) | ISC2 | MCQ | |
| Linux+ | CompTIA | MCQ + PBQ | Covers Linux administration and security essentials |

## SOC Analyst

| Cert | Vendor | Format | Notes |
|---|---|---|---|
| CySA+ | CompTIA | MCQ + PBQ | |
| Blue Team Level 1 (BTL1) | Security Blue Team | Practical | Incident-response scenario |
| Splunk Core Certified User | Splunk | MCQ | Needs SPL — SIEM lab must support SPL-style queries |
| SC-200 Security Operations Analyst | Microsoft | MCQ / case study | Needs KQL, Defender, Sentinel — SIEM lab must support KQL-style queries |
| GCIH (topic level) | GIAC | MCQ + hands-on | Topic coverage; GIAC exams are tied to SANS training but can be self-studied |

## Penetration Tester / VAPT

| Cert | Vendor | Format | Notes |
|---|---|---|---|
| eJPT | INE | Practical + MCQ | Entry practical |
| PenTest+ | CompTIA | MCQ + PBQ | |
| CEH + CEH Practical | EC-Council | MCQ / Practical | Widely asked for in Indian VAPT roles |
| OSCP / OSCP+ (PEN-200) | OffSec | Practical + Report | Needs real-VM practice hours (build-your-own-lab modules + v2 containers) |
| CPTS | Hack The Box | Practical + Report | Multi-day practical |
| CRTP | Altered Security | Practical + Report | Active Directory focus |

## Cloud Security

| Cert | Vendor | Format | Notes |
|---|---|---|---|
| AWS Certified Security – Specialty | AWS | MCQ | Primary target (track is AWS-first) |
| AZ-500 Azure Security Engineer | Microsoft | MCQ / labs | Needs an Azure module set added to the cloud roadmap |
| Professional Cloud Security Engineer | Google Cloud | MCQ | Needs a GCP module set |
| CCSK | Cloud Security Alliance | MCQ | Vendor-neutral |
| CCSP | ISC2 | MCQ | Full certification needs 5 years' experience; passing without it gives ISC2 Associate status |
| CKS Kubernetes Security Specialist | CNCF / Linux Foundation | Practical | Container/Kubernetes depth beyond the current roadmap |

## Cybersecurity (Purple Team)

Covers the SOC and Pentest lists above, plus:

| Cert | Vendor | Format | Notes |
|---|---|---|---|
| CRTO (topic level) | Zero-Point Security | Practical | Red team operations / C2 concepts |
| OSDA (topic level) | OffSec | Practical + Report | Defense analyst — the blue side of purple |
| GCFA (topic level) | GIAC | MCQ + hands-on | Forensics depth (B.L.A.D.E Phase 7) |
| GREM (topic level) | GIAC | MCQ + hands-on | Malware analysis depth (B.L.A.D.E Phase 7) |

## Out of scope for now (said honestly)

- **CISSP, CISM, CISA, CRISC** — management/governance exams with multi-year experience requirements; they belong to the future GRC/Leadership tracks (spec §3.1).
- **Any exam's actual questions** — never collected, recalled or reproduced ("dumps"). All practice questions are original and mapped to public objectives only.
- **No pass guarantee** (spec §12). We publish coverage % per cert and real learner pass rates instead.

## Roadmap gaps this list creates (to add to track roadmaps)

1. Cloud: Azure and Google Cloud module sets (AZ-500, GCP PCSE); deeper Kubernetes (CKS).
2. SOC: Microsoft Defender/Sentinel module and KQL; Splunk SPL module.
3. Pentest: CEH breadth sweep (CEH covers many topics briefly — a "breadth" module set closes gaps); report formats for OSCP/CPTS/CRTP.
4. Purple Team: CRTO/OSDA/GCFA/GREM topic sweeps on top of B.L.A.D.E Phases 5–7.
