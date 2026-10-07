Network monitoring has captured DNS resolution queries on the office network. The security team suspects suspicious beaconing and lookup failures indicative of domain typosquatting or malware activity.

**What to do**

1. Filter for DNS response traffic (`dns.flags.response == 1`) to find which domain failed resolution with an `NXDOMAIN` (No such name) response.
2. Find the DNS resolution for `beacon.example` and extract its resolved IPv4 address from the answer record.
3. Determine which internal client IP address generated the most DNS query traffic (`dns.flags.response == 0`).

This packet trace is a simulated capture and you are authorized to inspect all DNS traffic.
