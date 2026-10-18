
export type NetRangeProtocol = "tcp" | "udp";
export type NetRangePortState = "open" | "closed" | "filtered";
export type NetRangeOS = "linux" | "windows";
export type NetRangeUserRole = "user" | "root" | "administrator";

export type NetRangeHttpEndpoint = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  status?: number;
  body: string;
};

export type NetRangeSmbShare = {
  name: string;
  comment?: string;
  readOnly?: boolean;
  files?: Record<string, string>;
};

export type NetRangeFtpData = {
  anon?: boolean;
  files?: Record<string, string>;
};

export type NetRangeService = {
  port: number;
  protocol?: NetRangeProtocol;
  name: string;
  version?: string;
  banner?: string;
  state?: NetRangePortState;
  scripts?: Record<string, string>;
  httpData?: Record<string, NetRangeHttpEndpoint>;
  smbData?: NetRangeSmbShare[];
  ftpData?: NetRangeFtpData;
};

export type NetRangeUser = {
  username: string;
  password?: string;
  hash?: string;
  role: NetRangeUserRole;
};

export type NetRangeFile = {
  content: string;
  owner?: string;
  permissions?: string;
  isSuid?: boolean;
};

export type NetRangeSudoRule = {
  user: string;
  runAs: string;
  command: string;
  nopasswd: boolean;
};

export type NetRangeVulnEffect =
  | { type: "shell"; targetUser: string }
  | { type: "file_read"; revealedFile: string; content: string }
  | { type: "cred_disclosure"; credentials: Array<{ user: string; pass: string }> };

export type NetRangeVulnerability = {
  id: string;
  name: string;
  cve?: string;
  port?: number;
  service?: string;
  preconditions?: {
    requiresCreds?: boolean;
    requiresPort?: number;
    requiresPayloadKeyword?: string;
  };
  exploitPayload?: string;
  searchsploitTitle?: string;
  searchsploitPath?: string;
  effect: NetRangeVulnEffect;
};

export type NetRangeInterface = {
  ip: string;
  subnet: string;
  mac?: string;
};

export type NetRangeWindowsService = {
  name: string;
  displayName?: string;
  binPath: string;
  startType?: "auto" | "demand" | "disabled";
  runAs?: string;
  state?: "RUNNING" | "STOPPED";
  unquotedPath?: boolean;
  canConfigure?: boolean;
};

export type NetRangeHost = {
  id: string;
  hostname: string;
  os: NetRangeOS;
  interfaces: NetRangeInterface[];
  services: NetRangeService[];
  users: NetRangeUser[];
  filesystem?: Record<string, NetRangeFile>;
  sudoRules?: NetRangeSudoRule[];
  vulnerabilities?: NetRangeVulnerability[];
  windowsServices?: NetRangeWindowsService[];
};

export type NetRangeSubnet = {
  cidr: string;
  name: string;
  accessibleFromStart: boolean;
};

export type NetRangePivotRule = {
  targetSubnet: string;
  viaHost: string;
  requiresCompromise: boolean;
};

export type NetRangeFlag = {
  id: string;
  flag: string;
  hostId: string;
  path?: string;
  objectiveId: string;
};

export type NetRangeScenario = {
  id: string;
  title: string;
  description: string;
  author?: string;
  subnets: NetRangeSubnet[];
  hosts: NetRangeHost[];
  pivotRules?: NetRangePivotRule[];
  flags: NetRangeFlag[];
  attackerTools?: string[];
  wordlists?: Record<string, string[]>;
  randomizationPoints?: Record<string, unknown>;
};

export type NetRangeEnv = {
  scenario: NetRangeScenario;
  attackerIp: string;
  attackerHostname: string;
  initialRoutes: string[];
};

export type NetRangeSession = {
  id: number;
  hostId: string;
  user: string;
  type: "ssh" | "shell" | "meterpreter";
  openedAt?: string;
};

export type NetRangeState = {
  currentHostId: string | null;
  currentUser: string;
  currentCwd: string;
  routes: string[];
  sessions: NetRangeSession[];
  activeSessionId: number | null;
  crackedHashes: Record<string, string>;
  downloadedFiles: Record<string, string>;
  history: string[];
  socksTunnels?: Array<{ port: number; hostId: string }>;
  msfContext?: {
    selectedModule?: string;
    options: Record<string, string>;
  };
};

export type NetRangeCmdResult = {
  stdout: string;
  stderr: string;
  code: number;
  nextState: NetRangeState;
  prompt: string;
  submit?: { objective: number; answer: string };
};
