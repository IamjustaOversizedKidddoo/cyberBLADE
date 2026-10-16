# Evidence log: SOC Level 2 practice exams (Stage 1)

Screenshots (outside the repo): `D:\CYBER-PLATFORM-evidence\soc-l2-exams\<screen>-<390|768|1440>.png`.
Design rules: `ui-ux-pro-max` and `design-taste-frontend` applied; strictly uses existing CyberBLADE design tokens (`bg-surface`, `bg-void`, `border-line`, `text-ink`, `text-secondary`, `text-muted`, `text-cyan`, `font-ui`, `font-mono`, `font-sans`).
All interactive controls meet the 44px touch target floor; full keyboard navigation support; contrast meets WCAG 2.2 AA; no motion added; zero oracle on unsubmitted hold-outs.

| Screen | Evidence | Accessibility & Design Checks |
|---|---|---|
| L2 Investigation Runner `/labs/soc/exams/[examId]` | l2-investigation-*.png | Multi-stage scoping workspace; sticky HUD below navbar; scoping report editor (`scoping-report-l2`); budget limits displayed; keyboard accessible submit modal |
| Detection Rule Editor `/labs/soc/exams/[examId]` | detection-rule-editor-*.png | Form controls for Title, Severity, MITRE ATT&CK Tactic, Technique ID, Description, and BladeQL Query (max 4000 chars); status updates in aria-live region; SIEM exploration below; 44px save button |
| Detection Rule Results `/labs/soc/exams/[examId]` | detection-rule-result-*.png | Post-submission breakdown: hold-out recall (TPR), benign twin decoy trigger rate (FPR), precision, rule quality score; diagnostic feedback list; no hold-out ground truth leaked to client |
| L2 Knowledge Runner `/labs/soc/exams/[examId]` | l2-knowledge-exam-*.png | 25 items drawn from `knowledge-bank-l2.yaml`; accessible fieldsets with legend headers; keyboard ordering controls; silent answer persistence |
| L2 Readiness Gate `/labs/soc/exams/readiness` | l2-readiness-*.png | Distinct Level 1 and Level 2 provisional readiness panels; exact wording rule enforced (*"Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam."*); unmet criteria listed with icons + text; study plan works when drills are switched off |

Automated: `tests/e2e/soc-exams.spec.ts` (keyboard journey, 390px viewport, WCAG 2.2 AA zero serious/critical axe violations, zero overflow).
