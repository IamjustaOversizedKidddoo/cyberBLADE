import type { Metadata } from "next";
import Link from "next/link";
import { BETA_NOTICE_POINTS } from "@/lib/beta/notice";

export const metadata: Metadata = { title: "Help · CyberBLADE" };

const FAQ: Array<[string, string]> = [
  ["What is this beta?", "A closed, invite-only test of CyberBLADE with a small group of learners. Features may change, break or be removed, and progress may need to be reset if we find a serious problem."],
  ["Are the lessons finished?", "No. Lessons are drafts that have been checked by tools but not yet reviewed by a human expert. Please use “Report a problem” on anything that looks wrong."],
  ["Do practice exams or the readiness check mean I will pass a real exam?", "No. Practice exams are unproctored practice on our simulator. Scores and the readiness check are provisional estimates. Nothing here guarantees passing any exam or getting a job, and none of it is affiliated with or endorsed by any certification body."],
  ["My invite code doesn't work.", "Codes can expire, be used up or be withdrawn. Check you typed it exactly (letters and numbers, dashes optional), then ask the person who invited you for a new one."],
  ["I signed in with email or Google but was sent back to the start page.", "New learners must enter their invite code first, then sign in in the same browser within 30 minutes."],
  ["How do I report a problem?", "Use the Feedback button (bottom right) or “Report a problem” next to a lesson question, exam question or scenario. You will get a reference number; quote it if you contact us."],
  ["How do I get a copy of my data?", "Go to Account and choose “Download my data”. You get a JSON file with your profile, progress, answers, reports, exam results, feedback and notice acknowledgements."],
  ["How do I delete my account?", "Go to Account and choose “Delete my account”, then type DELETE to confirm. This permanently removes your account, progress, answers, reports, exam results and feedback."],
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 font-sans text-base text-ink sm:px-6">
      <h1 className="font-ui text-2xl">Help</h1>
      <section aria-labelledby="faq">
        <h2 id="faq" className="font-ui text-lg">Questions</h2>
        <dl className="mt-3 space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd className="mt-1 text-secondary">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="data">
        <h2 id="data" className="font-ui text-lg">Your data in this beta</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-secondary">
          {BETA_NOTICE_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="contact">
        <h2 id="contact" className="font-ui text-lg">Contact</h2>
        {/* PLACEHOLDER: the owner fills in a real contact address before the beta opens. */}
        <p className="mt-2 text-secondary">Contact: [owner to add a support email address before launch]. Include your reference number if you have one.</p>
      </section>
      <p><Link href="/account" className="text-cyan underline underline-offset-4 hover:text-ink">Account (export or delete your data)</Link></p>
    </main>
  );
}
