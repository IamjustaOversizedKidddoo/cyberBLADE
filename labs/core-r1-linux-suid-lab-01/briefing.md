# Mission Briefing: Privilege Audit

SUID (Set User ID) permissions and sudoers configurations allow unprivileged operators to run tasks with elevated privileges. However, misplaced SUID bits or overly permissive sudo entries represent substantial attack surface if misconfigured.

Your mission is to perform a defensive security audit on the target host: locate any anomalous SUID files, quantify the total SUID footprint, inspect binary ownership, and review granted sudo permissions.

### Objectives
1. Locate the non-standard SUID binary located outside the standard `/usr/bin` hierarchy.
2. Calculate the total count of SUID executables installed across the system.
3. Identify the owner of the anomalous SUID binary.
4. Review your user's sudo privileges and determine which program you can execute as root without a password.
