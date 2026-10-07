You have just joined a small team. Your manager gave you an account on the team's shared Linux machine and said: *"Everything we share is in `~/shared`. Some of it is private, so don't be surprised if you can't open everything."*

Your job is to understand **who can read what** — exactly what a security analyst checks when a company worries that private files are exposed.

**What to do**

1. Look inside `~/shared` with `ls -l ~/shared`. Each line starts with ten permission characters (for example `-rw-r--r--`) and shows the file's owner.
2. Try to open the files with `cat`. One of them will refuse with *Permission denied* — that is the file you are not allowed to read.
3. Find the file whose permissions mean *the owner can change it, everyone can read it*, and read the flag inside.

This machine is a simulation you are allowed to explore. Nothing you do here touches a real system.
