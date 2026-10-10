# Stored XSS & Session Hijacking

**Clearance Level:** Rank 2 (Watcher)  
**Target:** Sentinel Operations Incident Feed (`http://sentinel-feed.internal`)  
**Attack Vectors:** Stored Cross-Site Scripting (XSS) · Document Cookie Hijacking

---

### Situation

The Sentinel incident operations board allows security analysts to publish mission notes to a shared feed. The backend web framework stores input raw in the database without sanitizing HTML tags or stripping JavaScript event handlers.

An automated Administrator Review Bot reviews this feed periodically to sign off on operations.

### Objectives

1. **Session Cookie Extraction (`hijack_admin`):**
   - Submit a comment containing a valid JavaScript payload (`<script>...</script>` or `<img src=x onerror=...>`).
   - Trigger the Administrator Review Crawler using the dashboard action.
   - The crawler executes the embedded script in its privileged session context, exposing the administrative cookie flag (`CYBERBLADE{...}`).
