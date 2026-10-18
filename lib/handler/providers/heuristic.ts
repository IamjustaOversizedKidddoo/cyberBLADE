import type { HandlerMessage } from "../types";
import { detectCommand } from "../prompts";
import { CHALLENGE_LOCKOUT_MESSAGE } from "../guardrails";
import type { HandlerProvider } from "./types";

export class HeuristicProvider implements HandlerProvider {
  readonly name = "heuristic" as const;

  async generateReply(systemPrompt: string, _history: HandlerMessage[], userMessage: string): Promise<string> {
    const cmd = detectCommand(userMessage);

    // Challenge mode lockout
    if (systemPrompt.includes("CHALLENGE MODE ENGAGED")) {
      return CHALLENGE_LOCKOUT_MESSAGE;
    }

    const isLab = systemPrompt.includes("CURRENT LAB CONTEXT");
    const isPentest = systemPrompt.includes("PENETRATION TESTING WORKSPACE");

    let topic = "cybersecurity operations";
    const titleMatch =
      systemPrompt.match(/Title:\s*(.+)/i) ||
      systemPrompt.match(/Lab Title:\s*(.+)/i) ||
      systemPrompt.match(/Target Lab:\s*(.+)/i);
    if (titleMatch && titleMatch[1]) {
      topic = titleMatch[1].trim();
    }

    const lowerUser = userMessage.toLowerCase();
    const isHinglish =
      /\b(?:samajh|karein|kare|bhai|kaise|kya|kyun|madad|mujhe|aasan|dikkat|nahin|nahi)\b/i.test(lowerUser);

    // Frustration handling
    if (/\b(?:stuck|lost|give up|failing|fail|frustrated|confused|help me please)\b/i.test(lowerUser)) {
      if (isHinglish) {
        return (
          `### The Handler // Tactical Reset\n\n` +
          `Pareshan hone ki zaroorat nahi hai. Cybersecurity troubleshooting me step-by-step aage badhna hota hai.\n\n` +
          `1. **Current State:** Aapne terminal me abhi kya command chalayi?\n` +
          `2. **Observation:** Uska exact output kya tha?\n` +
          `3. **Next Step:** Briefing notes ko dobara scan karein ya \`help\` chala kar syntax check karein.\n\n` +
          `Aap specific command ya concept batayein, hum milkar step-by-step resolve karenge.`
        );
      }
      return (
        `### The Handler // Tactical Reset\n\n` +
        `Take a breath — feeling stuck is a completely normal part of learning real operational security.\n\n` +
        `Let's break the problem down into bite-sized pieces:\n` +
        `1. **Current State:** What command did you execute most recently in the terminal?\n` +
        `2. **Evidence:** What exact output or error did the terminal return?\n` +
        `3. **Hypothesis:** What file, port, or process are we trying to locate?\n\n` +
        `Tell me what you observed, and we'll walk through the methodology together.`
      );
    }

    // Hint requests in pentest mode (3 escalating levels)
    if (cmd === "hint" && isPentest) {
      const tierMatch =
        systemPrompt.match(/Hint tier\s*(\d+)/i) ||
        systemPrompt.match(/Learner's Authorized Hint Level:\s*Tier\s*(\d+)/i);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
      const readinessMatch = systemPrompt.match(/Learner Pentest Readiness:\s*(\d+)%/i);
      const weakMatch = systemPrompt.match(/Learner's Weak Areas:\s*([^\n]+)/i);

      let contextNote = "";
      if (readinessMatch && readinessMatch[1]) {
        contextNote += ` [Readiness: ${readinessMatch[1]}%]`;
      }
      if (weakMatch && weakMatch[1]) {
        contextNote += ` (Weak area focus: ${weakMatch[1].split(";")[0]})`;
      }

      if (tier === 1) {
        return (
          `### Tactical Guidance // The Handler (Hint Tier 1: Conceptual Flaw)${contextNote}\n\n` +
          `Analyze the service and input context:\n` +
          `- What software daemon or web endpoint is exposed on the target?\n` +
          `- What character, syntax delimiter, or parameter structure breaks the standard processing context?\n\n` +
          `*Tactical Tip:* Review the briefing notes and run initial non-destructive probes in the terminal.`
        );
      }

      if (tier === 2) {
        return (
          `### Tactical Guidance // The Handler (Hint Tier 2: Parameter & Tool Focus)${contextNote}\n\n` +
          `Direct your enumeration to the specific parameters:\n` +
          `- Inspect manual tool options and flags (e.g., check \`sudo -l\`, SUID bits via \`find / -perm -4000\`, or web request headers).\n` +
          `- Examine the output for anomalies, custom paths, or non-default permissions.\n\n` +
          `*Tactical Tip:* Narrow your test commands to the specific parameter or port identified in the initial scan.`
        );
      }

      return (
        `### Tactical Guidance // The Handler (Hint Tier 3: Step-by-Step Investigation)${contextNote}\n\n` +
        `Follow this systematic verification methodology:\n` +
        `1. Query the target endpoint with targeted arguments to confirm the vulnerability boundary.\n` +
        `2. Execute the verification command or probe to extract the proof-of-access string.\n` +
        `3. Submit your discovered value into the objective field.\n\n` +
        `*Operational Note:* Exact flags and ready-made exploit scripts are strictly withheld before solve. Execute these verification steps and inspect the target response.`
      );
    }

    // Hint requests in a lab
    if (cmd === "hint" && isLab) {
      // Look for a single authorized clue passed securely in system prompt
      const clueMatch = systemPrompt.match(/Authorized Guidance Clue:\s*\n"""\s*\n([\s\S]+?)\n"""/);
      if (clueMatch && clueMatch[1]) {
        return (
          `### Tactical Guidance // The Handler\n\n` +
          `Here is your unlocked operational clue:\n\n` +
          `> ${clueMatch[1].trim()}\n\n` +
          `*Next Step:* Test this methodology directly in the terminal and inspect the result.`
        );
      }

      // Default Tier 1 Socratic nudge
      if (isHinglish) {
        return (
          `### Tactical Guidance // The Handler\n\n` +
          `Active objective par focus karein. Objective ki requirement dhyan se padhein aur sochein ki kaunsa tool ya file check karni hai.\n\n` +
          `*Tactical Tip:* Terminal me \`help\` ya relevant command ke flags review karein. Agar mazeed hint chahiye, toh Objective box me **Request Hint** par click karein.`
        );
      }

      return (
        `### Tactical Guidance // The Handler\n\n` +
        `Focus on your active unsolved objective. Ask yourself:\n` +
        `- What system resource (file, process, log, or packet) holds the evidence?\n` +
        `- Have you inspected recent command outputs for errors or unexpected permissions?\n\n` +
        `*Tactical Tip:* Use \`help\` or check the manual flags for the relevant tool family in the terminal. If you need progressive hints unlocked, click **Request Hint** on the objective.`
      );
    }

    // Hinglish response adaptation for general questions
    if (isHinglish) {
      if (cmd === "what_is") {
        const queryTerm = userMessage.replace(/^(?:kya\s+hai|what\s+is)\s+/i, "").replace(/[?!.]+$/, "").trim() || topic;
        return (
          `### 1. ${queryTerm} kya hai?\n` +
          `Simple shabdon me, **${queryTerm}** ek critical mechanism hai jo ${topic} me security aur activity control ke liye use hota hai.\n\n` +
          `### 2. Yeh kyun zaroori hai?\n` +
          `Agar yeh na ho, toh unauthorized users bina kisi permission check ke critical resources access kar sakte hain.\n\n` +
          `### 3. Asaan Analogy\n` +
          `Jaise ek building ke entry gate par security guard har aane wale ka ID card check karta hai, vaise hi yeh rule har request ko inspect karta hai.\n\n` +
          `**Agla kadam:** Kya aap iska terminal implementation ya technical example dekhna chahte hain?`
        );
      }

      if (cmd === "why") {
        return (
          `### Cause & Effect // Kyun?\n\n` +
          `**Asaan vajah:** Agar hum yeh step skip karte hain, toh security telemetry me blind spots ban jaate hain aur attacks undetected reh sakte hain.\n\n` +
          `**Technical vajah:** Least privilege aur system boundary enforcement maintain rakhne ke liye har access point par strict audit telemetry zaroori hoti hai.`
        );
      }

      if (cmd === "simplify") {
        return (
          `### Bilkul Asaan Bhasha Me (No Jargon)\n\n` +
          `Socho aapke ghar ka darwaza hai. Agar chabi koi bhi copy kar le, toh koi bhi andar aa sakta hai. ` +
          `Security controls yeh ensure karte hain ki sirf sahi log darwaza khol sakein aur jab bhi darwaza khule, security log me record ban jaye.\n\n` +
          `Is topic (${topic}) me hum bas yehi verify kar rahe hain.`
        );
      }
    }

    // English command responses
    switch (cmd) {
      case "what_is": {
        const queryTerm = userMessage.replace(/^what\s+is\s+/i, "").replace(/[?!.]+$/, "").trim() || topic;
        return (
          `### 1. What is ${queryTerm}?\n` +
          `In simple terms, **${queryTerm}** is a core component used in ${topic} to control, monitor, or secure system activity.\n\n` +
          `### 2. Why does it exist?\n` +
          `Without it, defenders cannot reliably distinguish authorized actions from malicious intrusions, leaving systems vulnerable to blind exploitation.\n\n` +
          `### 3. How does it work?\n` +
          `It inspects requests, files, or telemetry against defined security rules, permitting safe operations and raising alerts on anomalies.\n\n` +
          `### 4. Simple Analogy\n` +
          `Think of it like a security checkpoint at a high-security facility: every person must present credentials and clear inspection before accessing critical areas.\n\n` +
          `### 5. Remember it like this:\n` +
          `**${queryTerm} = Verify identity and inspect activity before granting access.**\n\n` +
          `*Next Step:* Would you like an everyday example or a terminal demonstration?`
        );
      }

      case "why":
        return (
          `### Operational Cause & Effect // Why\n\n` +
          `**Simple reason:** If this step is skipped, attackers can operate unnoticed without triggering detection rules.\n\n` +
          `**Technical reason:** Security boundaries require strict telemetry, least privilege, and auditable events. When configuration boundaries fail, privilege boundaries collapse alongside them.\n\n` +
          `*Next Step:* Ready to inspect this in the terminal or look at an ASCII diagram?`
        );

      case "simplify":
        return (
          `### In Plain English (No Jargon)\n\n` +
          `Imagine you have a lock on your front door. If you leave the key under the mat, anyone can walk in. Security controls make sure only authorized people have keys, and every time the door opens, an alarm sounds if it happens at 3 AM.\n\n` +
          `In this topic (${topic}), we are simply checking who opened the door and whether they were allowed to.\n\n` +
          `*Next Step:* Does this mental model make sense, or would you like another angle?`
        );

      case "explain_again":
        return (
          `### Let's Look at This From Another Angle\n\n` +
          `Instead of viewing this as abstract computer code, look at it as a chain of physical evidence:\n\n` +
          `1. **The Action:** Something ran on the system or passed through the wire.\n` +
          `2. **The Fingerprint:** It left an artifact (a log event, a file permission, or a packet header).\n` +
          `3. **The Triage:** Our job is to correlate that artifact to discover what happened.\n\n` +
          `Does viewing it as an investigative chain make the relationship clearer?`
        );

      case "deep_dive":
        return (
          `### Technical Deep Dive // Architecture & Mechanics\n\n` +
          `Under the hood in **${topic}**:\n\n` +
          `- **Execution Context:** Operations run within specific privilege boundaries (Kernel Mode vs User Mode or DAC vs MAC).\n` +
          `- **Telemetry Pipeline:** System events pass from the kernel subsystem into security log buffers or socket interfaces.\n` +
          `- **Detection Surface:** Attackers attempt to blend into benign baseline telemetry. Defenders hunt anomalies by correlating parent-child relationships, hashes, and network flows.\n\n` +
          `*Next Step:* Would you like to review the specific OS structures or test your knowledge?`
        );

      case "example":
        return (
          `### Practical Examples // ${topic}\n\n` +
          `1. **Everyday Analogy:** Checking a package tracking number to confirm origin and destination.\n` +
          `2. **Technical Example:** Running an audit command in the terminal to inspect active permissions and ownership.\n` +
          `3. **Security Incident Example:** A SOC receives an alert for an unusual administrative process created outside business hours. The analyst queries telemetry to trace the parent process.\n\n` +
          `*Next Step:* What part of this example would you like to explore deeper?`
        );

      case "diagram":
        return (
          `### Architecture Flow // ASCII Diagram\n\n` +
          `\`\`\`text\n` +
          `+------------------+         +------------------+         +------------------+\n` +
          `|  Source / Client | ------> | Security Gate /  | ------> | Target Resource  |\n` +
          `|  (Actor)         |         | Inspection Point |         | (Host / Data)    |\n` +
          `+------------------+         +------------------+         +------------------+\n` +
          `                                      |\n` +
          `                                      v\n` +
          `                             +------------------+\n` +
          `                             |  Telemetry Log   |\n` +
          `                             |  (Event Records) |\n` +
          `                             +------------------+\n` +
          `\`\`\`\n\n` +
          `**Diagram Breakdown:**\n` +
          `- Traffic or execution requests originate at the actor node.\n` +
          `- The inspection layer evaluates permissions and policies.\n` +
          `- Every decision emits an auditable event record before reaching the target.`
        );

      case "test":
        return (
          `### Operational Knowledge Check // 5 Questions\n\n` +
          `1. **Basic:** What is the primary purpose of ${topic}?\n` +
          `2. **Conceptual:** Why is default trust dangerous in network or system architecture?\n` +
          `3. **Practical:** What terminal command or tool is used to inspect this configuration?\n` +
          `4. **Security:** How would an adversary attempt to evade detection in this scenario?\n` +
          `5. **Scenario:** You find an unauthorized entry running with elevated privileges. What is your first containment step?\n\n` +
          `*Reply with your answers and I will grade each one.*`
        );

      case "interview":
        return (
          `### Mock Technical Interview Question\n\n` +
          `*"Imagine you are a SOC analyst and you identify unusual persistence on an endpoint related to ${topic}. Walk me through how you would triage the event, collect evidence, and verify whether the threat is still active."*\n\n` +
          `Take a moment to formulate your answer and reply when ready.`
        );

      case "revision":
        return (
          `### Quick Revision Summary // ${topic}\n\n` +
          `- **What:** Essential mechanism for system control and security observability.\n` +
          `- **Why:** Prevents blind spots and restricts unauthorized privilege escalation.\n` +
          `- **How:** Enforces rules, logs security telemetry, and isolates critical assets.\n` +
          `- **Remember:** Always verify rather than assume trust.\n\n` +
          `*Ready to continue, or want a quick quiz?*`
        );

      case "recap":
        return (
          `### The Connected Chain // Recap\n\n` +
          `Everything you've learned connects into an unbroken chain:\n\n` +
          `**Networking** (how packets reach hosts) → **Operating System** (how files & processes execute) → **Telemetry** (how events are recorded) → **Investigation** (how we uncover threats).\n\n` +
          `In **${topic}**, you are applying this exact defensive pipeline.`
        );

      default:
        return (
          `### The Handler // Analysis\n\n` +
          `Regarding your question on **${topic}**:\n\n` +
          `Focus on the core principle: start with simple cause-and-effect before diving into complex flags. ` +
          `If you are working on a lab objective, review the briefing notes and run exploratory commands to inspect the environment.\n\n` +
          `Feel free to ask \`what is X?\`, \`why?\`, \`simplify\`, \`diagram\`, or \`hint\` for focused guidance.`
        );
    }
  }
}
