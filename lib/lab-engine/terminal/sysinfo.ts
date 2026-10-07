/** Fixed facts about the simulated machine (an Ubuntu 24.04 server), shared by uname and /proc. */
export const KERNEL = {
  name: "Linux",
  release: "6.8.0-45-generic",
  version: "#45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024",
  machine: "x86_64",
};

export const PROC_VERSION =
  `Linux version ${KERNEL.release} (buildd@lcy02-amd64-115) (x86_64-linux-gnu-gcc-13 (Ubuntu 13.2.0-23ubuntu4) 13.2.0, ` +
  `GNU ld (GNU Binutils for Ubuntu) 2.42) ${KERNEL.version}\n`;

const cpu = (n: number) =>
  [
    `processor\t: ${n}`,
    "vendor_id\t: GenuineIntel",
    "cpu family\t: 6",
    "model\t\t: 79",
    "model name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
    "stepping\t: 1",
    "cpu MHz\t\t: 2399.998",
    "cache size\t: 35840 KB",
    "physical id\t: 0",
    "siblings\t: 2",
    `core id\t\t: ${n}`,
    "cpu cores\t: 2",
    "flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht syscall nx rdtscp lm constant_tsc nopl xtopology cpuid pni pclmulqdq ssse3 fma cx16 sse4_1 sse4_2 x2apic movbe popcnt aes xsave avx f16c rdrand hypervisor lahf_lm abm avx2 smep bmi2 erms",
    "bogomips\t: 4799.99",
    "",
  ].join("\n") + "\n";

export const PROC_CPUINFO = cpu(0) + cpu(1);

export const PROC_MEMINFO =
  "MemTotal:        4015280 kB\n" +
  "MemFree:         1874312 kB\n" +
  "MemAvailable:    3290164 kB\n" +
  "Buffers:           98412 kB\n" +
  "Cached:          1402108 kB\n";

export const PROC_UPTIME = "3600.12 7012.40\n";
