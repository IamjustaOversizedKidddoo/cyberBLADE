# SQL Injection: Auth Bypass & Union Extraction

**Clearance Level:** Rank 2 (Watcher)  
**Target:** Apex Vault Internal Employee Portal (`http://apex-vault.internal`)  
**Attack Vectors:** Authentication Bypass · UNION-based Data Exfiltration

---

### Situation

Apex Financial maintains an internal asset vault guarded by a legacy SQL authentication portal. Intelligence confirms that user inputs are concatenated directly into SQL queries without parameterized queries or prepared statements.

### Objectives

1. **Authentication Bypass (`bypass_auth`):**
   - Inject an SQL statement into the username field (`' OR 1=1 --`) that forces the `WHERE` clause to evaluate to `TRUE`.
   - Gain administrative access to the `/dashboard` endpoint and capture the Tier-0 flag.

2. **UNION-based Data Extraction (`union_extract`):**
   - On the `/search` asset catalog page, the query reflects search results into an HTML table.
   - Use `UNION SELECT` syntax to join unauthorized database contents into the visible output.
   - Recover the classified flag (`CYBERBLADE{...}`).
