# BOLA / IDOR Horizontal Escalation

**Clearance Level:** Rank 2 (Watcher)  
**Target:** Vanguard Defense Personnel Archive (`http://vanguard-portal.internal`)  
**Attack Vectors:** Insecure Direct Object References (IDOR) · Broken Object Level Authorization (BOLA)

---

### Situation

Vanguard Defense deployed an internal REST API for personnel dossiers and contractor invoices. The endpoints accept object identifiers directly from client query parameters (`id=...`, `userId=...`) without checking whether the authenticated session user actually owns the requested resource.

### Objectives

1. **Executive Dossier Exfiltration (`exfiltrate_ciso`):**
   - Identify the user profile REST endpoint in the HTTP Inspector network trace (`/api/user/profile?id=104`).
   - Tamper with the `id` parameter to access the CISO's record (`id=101`).
   - Retrieve the confidential clearance flag (`CYBERBLADE{...}`).

2. **Unlinked Invoice Exfiltration (`exfiltrate_invoices`):**
   - Access the financial records endpoint (`/api/invoices?userId=101`).
   - Identify the unauthorized black-budget invoices and extract the flag.
