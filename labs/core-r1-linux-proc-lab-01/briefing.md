# Mission Briefing: Process Hunt

Threat actors frequently attempt to hide unauthorized payloads by executing binaries from temporary storage (`/tmp` or `/dev/shm`) and masquerading as legitimate kernel threads or system daemons.

Your task is to analyze the host's process tree, detect the rogue process, trace its parentage, and extract its command-and-control communication target.

### Objectives
1. Identify the PID of the disguised workload executing from a temporary folder.
2. Determine the user context under which this rogue workload is running.
3. Trace the Parent Process ID (PPID) to discover the name of the service or shell that spawned it.
4. Extract the external `host:port` network destination provided in its command-line parameters.
