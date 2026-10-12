export type FlashCard = {
  id: string;
  lessonId: string;
  rank: number;
  category: "linux" | "network" | "windows" | "web" | "defense";
  front: string;
  back: string;
  commandSnippet?: string;
};

export const FLASHCARDS: FlashCard[] = [
  // --- RANK 0: CORE TERMINAL & LINUX ---
  {
    id: "fc-r0-perms-01",
    lessonId: "core-r0-linux-permissions",
    rank: 0,
    category: "linux",
    front: "What do the numeric octal values 7, 5, and 4 represent in Linux file permissions?",
    back: "7 = Read (4) + Write (2) + Execute (1). 5 = Read (4) + Execute (1). 4 = Read only.",
    commandSnippet: "chmod 754 script.sh",
  },
  {
    id: "fc-r0-perms-02",
    lessonId: "core-r0-linux-permissions",
    rank: 0,
    category: "linux",
    front: "How do you identify files with the SUID bit set in Linux?",
    back: "Use find with -perm -4000. An 's' replaces 'x' in the user permissions section.",
    commandSnippet: "find / -perm -4000 2>/dev/null",
  },
  {
    id: "fc-r0-pipe-01",
    lessonId: "core-r0-linux-pipes",
    rank: 0,
    category: "linux",
    front: "What is the difference between stdout (FD 1) and stderr (FD 2) redirection in Bash?",
    back: "'> file' or '1> file' redirects standard output. '2> file' redirects standard error. '2>&1' redirects stderr into stdout.",
    commandSnippet: "command > output.txt 2>&1",
  },
  {
    id: "fc-r0-proc-01",
    lessonId: "core-r0-linux-processes",
    rank: 0,
    category: "linux",
    front: "Which command lists running processes with full command lines and process tree parentage?",
    back: "'ps aux' displays all system processes with user attribution. 'ps -ef' displays parent PIDs (PPID).",
    commandSnippet: "ps aux | grep suspicious",
  },
  {
    id: "fc-r0-text-01",
    lessonId: "core-r0-linux-text-processing",
    rank: 0,
    category: "linux",
    front: "How can you count the number of unique IP addresses appearing in an access log?",
    back: "Extract the IP column, sort alphabetically, then pass to uniq -c to group identical entries.",
    commandSnippet: "cut -d ' ' -f 1 access.log | sort | uniq -c | sort -nr",
  },

  // --- RANK 1: NETWORKING & PROTOCOLS ---
  {
    id: "fc-r1-net-ip-01",
    lessonId: "core-r1-net-ip-addressing",
    rank: 1,
    category: "network",
    front: "How many usable host IP addresses are in a /28 IPv4 subnet?",
    back: "14 usable hosts. A /28 has 32 - 28 = 4 host bits. 2^4 = 16 total minus 2 (network and broadcast) = 14.",
    commandSnippet: "ipcalc 192.168.1.0/28",
  },
  {
    id: "fc-r1-net-tcp-01",
    lessonId: "core-r1-net-tcp-handshake",
    rank: 1,
    category: "network",
    front: "What flags are exchanged during the TCP three-way handshake?",
    back: "1. Client sends SYN (synchronize). 2. Server sends SYN-ACK (acknowledge). 3. Client sends ACK.",
  },
  {
    id: "fc-r1-net-scan-01",
    lessonId: "core-r1-pkt-port-scanning",
    rank: 1,
    category: "network",
    front: "How does a TCP SYN (half-open) stealth scan determine an open port?",
    back: "The scanner sends SYN. If the target replies with SYN-ACK, the port is open; the scanner immediately sends RST to close without completing the handshake.",
    commandSnippet: "nmap -sS -p 80,443 target_ip",
  },
  {
    id: "fc-r1-net-dns-01",
    lessonId: "core-r1-net-dns-resolution",
    rank: 1,
    category: "network",
    front: "What is the security difference between recursive and authoritative DNS queries?",
    back: "Recursive servers query other servers on behalf of a client until finding an answer; authoritative servers hold definitive zone records for specific domains.",
    commandSnippet: "dig +trace example.com",
  },
  {
    id: "fc-r1-net-http-01",
    lessonId: "core-r1-net-http-basics",
    rank: 1,
    category: "network",
    front: "What HTTP status code range represents client errors versus server errors?",
    back: "4xx codes (e.g. 400 Bad Request, 403 Forbidden, 404 Not Found) are client errors. 5xx codes (e.g. 500 Internal Error, 502 Bad Gateway) are server errors.",
  },
  {
    id: "fc-r1-win-event-01",
    lessonId: "core-r1-win-event-logs",
    rank: 1,
    category: "windows",
    front: "Which Windows Security Event ID signifies a successful logon versus a failed logon?",
    back: "Event ID 4624 indicates a successful logon. Event ID 4625 indicates a failed logon attempt.",
    commandSnippet: "Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625}",
  },
  {
    id: "fc-r1-win-ps-01",
    lessonId: "core-r1-win-powershell",
    rank: 1,
    category: "windows",
    front: "How do you inspect running services and their startup types in PowerShell?",
    back: "Use Get-Service or Get-CimInstance win32_service to inspect start mode (Auto, Manual, Disabled).",
    commandSnippet: "Get-CimInstance win32_service | Select-Object Name, StartMode, State",
  },

  // --- RANK 2: WEB SECURITY & DEFENSE ---
  {
    id: "fc-r2-sqli-01",
    lessonId: "core-r2-web-sqli-basics",
    rank: 2,
    category: "web",
    front: "Why does `' OR 1=1 --` bypass authentication in vulnerable login forms?",
    back: "It injects a tautology ('1=1' is always true) into the WHERE clause and comments out the password verification check.",
  },
  {
    id: "fc-r2-sqli-02",
    lessonId: "core-r2-web-sqli-basics",
    rank: 2,
    category: "defense",
    front: "What is the primary defense against SQL Injection?",
    back: "Parameterized queries (prepared statements). The database treats user input strictly as data, never executable SQL grammar.",
  },
  {
    id: "fc-r2-xss-01",
    lessonId: "core-r2-web-xss-basics",
    rank: 2,
    category: "web",
    front: "What is the difference between Reflected XSS and Stored XSS?",
    back: "Reflected XSS bounces user input from the immediate request (URL/query). Stored XSS persists payload into a database and executes for everyone who views the page.",
  },
  {
    id: "fc-r2-xss-02",
    lessonId: "core-r2-web-xss-basics",
    rank: 2,
    category: "defense",
    front: "How does the HttpOnly cookie flag protect against Cross-Site Scripting (XSS)?",
    back: "It blocks JavaScript from reading `document.cookie`, preventing session token exfiltration even if an attacker executes script on the page.",
  },
  {
    id: "fc-r2-csp-01",
    lessonId: "core-r2-web-defense-csp",
    rank: 2,
    category: "defense",
    front: "What does the Content-Security-Policy directive `script-src 'self' 'nonce-xyz'` enforce?",
    back: "It only allows execution of scripts loaded from the same origin or containing the cryptographic matching nonce attribute, disarming injected inline scripts.",
  },
];

export function getFlashcardById(id: string): FlashCard | undefined {
  return FLASHCARDS.find((c) => c.id === id);
}

export function getFlashcardsByRank(rank: number): FlashCard[] {
  return FLASHCARDS.filter((c) => c.rank <= rank);
}
