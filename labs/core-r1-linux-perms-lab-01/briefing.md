# Mission Briefing: Permission Puzzle

A system migration left several critical files with questionable ownership and mode configurations. As an operator auditing this host, your task is to verify mode calculations, restore access to personal data, determine sensitive access rights, and pinpoint risky world-writable files.

### Objectives
1. Inspect `/srv/app/config.ini` and determine its 3-digit octal permissions (e.g. `644`, `640`).
2. Restore access to `~/vault/note.txt` using `chmod`, read the file, and submit the flag.
3. Determine which department group possesses access rights to `/srv/payroll/salaries.csv`.
4. Audit `/srv/shared/` to find the single file that has been left dangerously world-writable.
