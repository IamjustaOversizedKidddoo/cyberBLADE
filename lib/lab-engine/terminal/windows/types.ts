export type RegistryValues = Record<string, string | number>;

export type RegistryHive = Record<string, RegistryValues>;

export type WinEvent = {
  logName: string;
  id: number;
  levelDisplayName?: string;
  timeCreated: string;
  message: string;
  data?: Record<string, string>;
};

export type WinTask = {
  taskName: string;
  taskPath?: string;
  state: "Ready" | "Running" | "Disabled";
  action: string;
};
