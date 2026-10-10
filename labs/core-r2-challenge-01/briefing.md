# Operation Watchtower: Full Web Spectrum IR & Exploitation

**Operational Clearance:** Rank 2 (Watcher)  
**Target:** Operation Watchtower Master Command Portal (`http://watchtower.cyberblade.lab`)  
**Time Limit:** 35 Minutes  
**Triage Vectors:** IDOR · SQL Injection · Session Token Tampering

---

### Threat Intelligence & Tactical Briefing

Hostile APT actors have established an administrative staging node inside the internal defense network under the moniker **Operation Watchtower**.

The node exposes a monolithic web portal with several interconnected flaws:
1. An unprotected contract repository API susceptible to Insecure Direct Object References.
2. A legacy order verification engine lacking SQL parameterization.
3. An administrative debugging interface protected only by a client-controlled cookie.

### Mission Objectives

1. **Classified Contract Exfiltration (`exfiltrate_contract`):**
   - Query `/api/contracts?ref=CTR-7701` to bypass reference checks and capture the contract flag.

2. **Order Verification Bypass (`extract_order`):**
   - Inject SQL logic into `/orders/lookup?code=...` to dump internal records and retrieve the order flag.

3. **Master Debugging Privilege Escalation (`tamper_role`):**
   - Tamper with the `watchtower_role` cookie in the Cookie Jar (set to `superadmin`) to authenticate against `/admin/debug`.
   - Recover the master root flag.

*Successful completion promotes the operator from Rank 2 (Watcher) to Rank 3 (Sentinel).*
