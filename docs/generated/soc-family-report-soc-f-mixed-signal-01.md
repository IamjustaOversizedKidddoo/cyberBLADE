# SOC Scenario Family Quality Report: L1 Reference: Mixed-Signal Shift (soc-f-mixed-signal-01)

> **Generated**: 2026-10-12T19:17:41.478Z  
> **Family Version**: `1` | **Review Status**: `approved` | **Level**: `L1`  
> **Tested Seeds per Difficulty**: 1000 (Total Evaluated Scenarios: 3000)  
> **Evaluator**: CyberBLADE 7-Layer Procedural Proof Toolchain (`lib/lab-engine/soc/family-validator.ts`)

---

## 1. Executive Summary

| Difficulty | Structural Pass | Semantic Pass | Anti-Tell Pass | Zero-Leak Pass | Ref Solver Mean (Min) | Best Naive Max | Discretion Margin | Mean Pairwise Dist | SLA p95 (ms) | Final Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BEGINNER** | 100% | 100% | 100% | 100% | 86.6% (80%) | 58% | +22% | 0.794 | 0.93 ms | **PASSED** |
| **INTERMEDIATE** | 100% | 100% | 100% | 100% | 88.4% (82%) | 59% | +23% | 0.794 | 0.83 ms | **PASSED** |
| **ADVANCED** | 100% | 100% | 100% | 100% | 86.8% (82%) | 57% | +25% | 0.666 | 1.07 ms | **PASSED** |

---

## 2. Solver Proof & Non-Triviality Benchmark

To mathematically prove that variants are neither unsolvable nor trivially guessable, CyberBLADE evaluates every generated variant against both a competent **Reference Solver** and 5 adversarial **Naive Solvers**.

### 2.1 Solver Performance by Difficulty

#### BEGINNER Profile (1000 Seeds)
- **Reference Solver Accuracy**:
  - Minimum Accuracy: **80%** (Threshold: $\ge 75\%$)
  - Mean Accuracy: **86.6%**
  - Maximum Accuracy: **94%**
  - Passing Seeds Rate: **100%**
- **Adversarial Naive Solvers (Ceilings & Exploitation Resistance)**:
  - `Naive: Always Escalate`: Max = **26%** (Mean = 26%, Ceiling: $\le 70\%$)
  - `Naive: Always Dismiss`: Max = **53%** (Mean = 53%, Ceiling: $\le 70\%$)
  - `Naive: Trust Tool Severity`: Max = **52%** (Mean = 52%, Ceiling: $\le 70\%$)
  - `Naive: Keyword Match`: Max = **58%** (Mean = 56.3%, Ceiling: $\le 70\%$)
  - `Naive: Random Guessing`: Max = **53%** (Mean = 44%, Ceiling: $\le 70\%$)
- **Discretion Margin (Reference - Best Naive)**: **+22%** (Required: $\ge +15\%$)

#### INTERMEDIATE Profile (1000 Seeds)
- **Reference Solver Accuracy**:
  - Minimum Accuracy: **82%** (Threshold: $\ge 75\%$)
  - Mean Accuracy: **88.4%**
  - Maximum Accuracy: **95%**
  - Passing Seeds Rate: **100%**
- **Adversarial Naive Solvers (Ceilings & Exploitation Resistance)**:
  - `Naive: Always Escalate`: Max = **24%** (Mean = 23.3%, Ceiling: $\le 70\%$)
  - `Naive: Always Dismiss`: Max = **55%** (Mean = 55%, Ceiling: $\le 70\%$)
  - `Naive: Trust Tool Severity`: Max = **52%** (Mean = 52%, Ceiling: $\le 70\%$)
  - `Naive: Keyword Match`: Max = **59%** (Mean = 57.7%, Ceiling: $\le 70\%$)
  - `Naive: Random Guessing`: Max = **54%** (Mean = 44.4%, Ceiling: $\le 70\%$)
- **Discretion Margin (Reference - Best Naive)**: **+23%** (Required: $\ge +15\%$)

#### ADVANCED Profile (1000 Seeds)
- **Reference Solver Accuracy**:
  - Minimum Accuracy: **82%** (Threshold: $\ge 75\%$)
  - Mean Accuracy: **86.8%**
  - Maximum Accuracy: **91%**
  - Passing Seeds Rate: **100%**
- **Adversarial Naive Solvers (Ceilings & Exploitation Resistance)**:
  - `Naive: Always Escalate`: Max = **25%** (Mean = 25%, Ceiling: $\le 70\%$)
  - `Naive: Always Dismiss`: Max = **54%** (Mean = 54%, Ceiling: $\le 70\%$)
  - `Naive: Trust Tool Severity`: Max = **52%** (Mean = 52%, Ceiling: $\le 70\%$)
  - `Naive: Keyword Match`: Max = **57%** (Mean = 57%, Ceiling: $\le 70\%$)
  - `Naive: Random Guessing`: Max = **52%** (Mean = 44.1%, Ceiling: $\le 70\%$)
- **Discretion Margin (Reference - Best Naive)**: **+25%** (Required: $\ge +15\%$)

---

## 3. Anti-Tell & Leakage Analysis

Procedurally generated security scenarios risk accidental artifacts ("tells") that allow learners or naive classifiers to discern malicious alerts from benign noise without performing genuine investigative correlation.

### 3.1 Feature Invariance Audit Across Seeds
- **Structural Invariance Rate**: **100%** across evaluated variants
- **Anti-Tell Decision-Stump Invariance**: Pass Rate = **100%**
- **Single-Feature Leak Classification**: No single metadata field (casing, length, entropy, timestamp offset, raw field count) predicts ground truth above the 72.0% balanced accuracy threshold.

### 3.2 Client View Zero-Knowledge Audit
- **Ground Truth Exposure in Client Projection**: **0 occurrences** (100% clean)
- **Forbidden Substrings Scan**: Passed across all seeds (no `groundTruth`, `stageId`, `attackChain`, `seed`, or uncalibrated leakage tokens).

---

## 4. Variant Diversity & Combinatorial Uniqueness

To guarantee that learners cannot share answers or memorize static IOCs across retakes:

- **BEGINNER Profile**:
  - Minimum Pairwise Distance: **0.393**
  - Mean Pairwise Distance: **0.794**
  - Distinct Ground-Truth Answer Sets: **1000 / 1000** (100% unique answer vectors)
- **INTERMEDIATE Profile**:
  - Minimum Pairwise Distance: **0.326**
  - Mean Pairwise Distance: **0.794**
  - Distinct Ground-Truth Answer Sets: **1000 / 1000** (100% unique answer vectors)
- **ADVANCED Profile**:
  - Minimum Pairwise Distance: **0.382**
  - Mean Pairwise Distance: **0.666**
  - Distinct Ground-Truth Answer Sets: **1000 / 1000** (100% unique answer vectors)

---

## 5. Performance & Generation SLA

All variants are generated entirely in pure CPU memory using seeded PRNG streams, without database round-trips or disk I/O.

| Metric | Beginner | Intermediate | Advanced | SLA Requirement |
| :--- | :---: | :---: | :---: | :---: |
| **Generation Time (p50)** | 0.54 ms | 0.65 ms | 0.82 ms | $< 50$ ms |
| **Generation Time (p95)** | 0.93 ms | 0.83 ms | 1.07 ms | $< 100$ ms |
| **Generation Time (Max)** | 18.83 ms | 12.53 ms | 1.83 ms | $< 150$ ms |
| **Rejection Reseed Rate** | 0% | 0% | 0% | $< 5.0\%$ |

---

## 6. Reviewer Findings & Recommendations

✓ **No weaknesses or violations identified.** This family satisfies all mathematical criteria for deployment in practitioner training and examination modes.

### Approval Sign-Off
- **Automated Validation**: PASSED
- **Author**: `CyberBLADE SOC Curriculum Engineering`
- **Reviewed By**: CyberBLADE Automated Quality Gate & SOC Practitioner Review Board
