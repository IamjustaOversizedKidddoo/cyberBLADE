/**
 * Beta notice wording (version BETA_NOTICE_VERSION). Written to match what the code actually does
 * as of 2026-10-16; see docs/ops/deploy-vercel.md "Data practices". FLAGGED FOR LAWYER REVIEW before
 * the beta opens: it is plain-language information, not a privacy policy or terms of service.
 */
export const BETA_NOTICE_TITLE = "Before you start: this is a closed beta";

export const BETA_NOTICE_POINTS: string[] = [
  "CyberBLADE is in a closed beta. Things will break, change or be removed, and your progress may need to be reset if we find a serious problem.",
  "Lessons are drafts that have been checked by tools but not yet reviewed by a human expert. If something looks wrong, use “Report a problem”.",
  "Practice exams are unproctored practice. Scores and the readiness check are provisional estimates on our simulator. Nothing here guarantees passing any exam or getting a job.",
  "We store what you do here so the app works: your handle, your sign-in email (if you sign in by email or an external account), your progress, your answers, the text you write (rationales, reports, notes, feedback) and when you did each thing.",
  "If you use the Handler (the AI tutor), your message and the lesson or lab context are sent to an external AI provider to generate the reply. Do not put personal or confidential information in it. AI report feedback is switched off in this beta.",
  "Error logs are kept to fix problems. They are written so that they leave out emails, IP addresses, sign-in tokens and the text you write.",
  "You can export your data or delete your account at any time from Account. Deleting removes your progress, answers, feedback and account.",
  "Questions or problems: see Help.",
];

export const BETA_BANNER_TEXT = "Closed beta: practice exams are unproctored, scores are provisional estimates, and nothing here guarantees passing any exam.";
