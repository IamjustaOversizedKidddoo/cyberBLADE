import type { HandlerMessage } from "../types";
import { detectCommand } from "../prompts";
import type { HandlerProvider } from "./types";

export class HeuristicProvider implements HandlerProvider {
  readonly name = "heuristic" as const;

  async generateReply(systemPrompt: string, _history: HandlerMessage[], userMessage: string): Promise<string> {
    const cmd = detectCommand(userMessage);

    // Check if system prompt indicated challenge mode
    if (systemPrompt.includes("CHALLENGE MODE ENGAGED")) {
      return "[COMM LINK SEVERED] Handler assistance is offline during active rank challenges. Operators must rely entirely on their own methodology and training.";
    }

    // Extract lab context if present in systemPrompt
    const isLab = systemPrompt.includes("CURRENT LAB CONTEXT");

    let topic = "cybersecurity operations";
    const titleMatch = systemPrompt.match(/Title:\s*(.+)/i);
    if (titleMatch && titleMatch[1]) {
      topic = titleMatch[1].trim();
    }

    // Look for hints in system prompt if user is asking for a hint in a lab
    if (cmd === "hint" && isLab) {
      const hintLadderMatch = systemPrompt.match(/Authorized Hint Ladder[\s\S]+?(?=\n\n|$)/);
      if (hintLadderMatch) {
        return (
          `### Tactical Guidance // The Handler\n\n` +
          `Here is your progressive operational hint:\n\n` +
          `> ${hintLadderMatch[0].split("\n").slice(1).join("\n> ")}\n\n` +
          `*Remember: Verify syntax carefully in the terminal before submitting.*`
        );
      }
      return (
        `### Tactical Guidance // The Handler\n\n` +
        `Focus on the active unsolved objective. Check your recent commands, read the briefing requirements, and inspect the filesystem or logs carefully.\n\n` +
        `*Tip: Run \`help\` or check the manual flags for the relevant command.*`
      );
    }

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
          `**${queryTerm} = Verify identity and inspect activity before granting access.**`
        );
      }

      case "why":
        return (
          `### Operational Cause & Effect // Why\n\n` +
          `**Simple reason:** If this step is skipped, attackers can operate unnoticed without triggering detection rules.\n\n` +
          `**Technical reason:** Security boundaries require strict telemetry, least privilege, and auditable events. When configuration boundaries fail, privilege boundaries collapse alongside them.`
        );

      case "simplify":
        return (
          `### In Plain English (No Jargon)\n\n` +
          `Imagine you have a lock on your front door. If you leave the key under the mat, anyone can walk in. Security controls make sure only authorized people have keys, and every time the door opens, an alarm sounds if it happens at 3 AM.\n\n` +
          `In this topic (${topic}), we are simply checking who opened the door and whether they were allowed to.`
        );

      case "explain_again":
        return (
          `### Let's Look at This From Another Angle\n\n` +
          `Instead of viewing this as abstract computer code, look at it as a chain of evidence:\n\n` +
          `1. **The Action:** Something ran on the system or passed through the wire.\n` +
          `2. **The Fingerprint:** It left an artifact (a log event, a registry key, or a packet header).\n` +
          `3. **The Triage:** Our job is to correlate that artifact to discover what happened.\n\n` +
          `Does that make the relationship clearer?`
        );

      case "deep_dive":
        return (
          `### Technical Deep Dive // Architecture & Mechanics\n\n` +
          `Under the hood in **${topic}**:\n\n` +
          `- **Execution Context:** Operations run within specific privilege rings (Kernel Mode vs User Mode).\n` +
          `- **Telemetry Pipeline:** System events pass from the kernel subsystem into security log buffers or socket interfaces.\n` +
          `- **Detection Surface:** Attackers attempt to blend into benign baseline telemetry. Defenders hunt anomalies by correlating parent-child relationships, hashes, and network flows.`
        );

      case "example":
        return (
          `### Practical Examples // ${topic}\n\n` +
          `1. **Everyday Analogy:** Checking a package tracking number to confirm origin and destination.\n` +
          `2. **Technical Example:** Running an audit command in the terminal to inspect active properties.\n` +
          `3. **Security Incident Example:** A SOC receives an alert for an unusual administrative process created outside business hours. The analyst queries telemetry to trace the parent process.`
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
          `- **Remember:** Always verify rather than assume trust.`
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
