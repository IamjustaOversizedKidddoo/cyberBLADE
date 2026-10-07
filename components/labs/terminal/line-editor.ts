export type LineEvent =
  | { type: "echo"; text: string }
  | { type: "submit"; line: string }
  | { type: "interrupt" }
  | { type: "clear" }
  | { type: "history"; direction: "prev" | "next" };

const ERASE = "\b \b";

/**
 * Minimal readline for the lab terminal: printable input, Backspace, Enter, Ctrl+C, Ctrl+L,
 * Up/Down for history. The cursor always sits at the end of the line.
 * `feed` takes whatever xterm hands over (a key or a whole paste) and returns what happened.
 */
export function createLineEditor() {
  let buffer = "";

  function feed(data: string): LineEvent[] {
    const events: LineEvent[] = [];
    let pending = "";
    const flushEcho = () => {
      if (pending) events.push({ type: "echo", text: pending });
      pending = "";
    };

    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      if (c === "\x1b") {
        // CSI sequence: ESC [ <params> <final letter>
        let j = i + 1;
        if (data[j] === "[") {
          j++;
          while (j < data.length && !/[A-Za-z~]/.test(data[j])) j++;
        }
        const final = data[j];
        flushEcho();
        if (final === "A") events.push({ type: "history", direction: "prev" });
        else if (final === "B") events.push({ type: "history", direction: "next" });
        i = j;
      } else if (c === "\r" || c === "\n") {
        if (c === "\n" && data[i - 1] === "\r") continue;
        flushEcho();
        events.push({ type: "echo", text: "\r\n" }, { type: "submit", line: buffer });
        buffer = "";
      } else if (c === "\x7f" || c === "\b") {
        if (buffer.length === 0) continue;
        buffer = buffer.slice(0, -1);
        pending += ERASE;
      } else if (c === "\x03") {
        flushEcho();
        events.push({ type: "echo", text: "^C\r\n" }, { type: "interrupt" });
        buffer = "";
      } else if (c === "\x0c") {
        flushEcho();
        events.push({ type: "clear" });
      } else if (c >= " ") {
        buffer += c;
        pending += c;
      }
      // Other control characters (Tab, Ctrl+A…) are ignored.
    }
    flushEcho();
    return events;
  }

  /** Replaces the current line (history recall). Returns the text to write to the terminal. */
  function replace(text: string): string {
    const out = ERASE.repeat(buffer.length) + text;
    buffer = text;
    return out;
  }

  return { feed, replace, buffer: () => buffer };
}
