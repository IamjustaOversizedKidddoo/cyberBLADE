# Scenario Practice: Cloud Identity & Privilege Escalation

Investigates cloud control-plane audit logs (CloudTrail/Cloud Audit style) for suspicious administrative role assignments, service principal key creation, and unauthorized privilege escalation.

### Learning Goals
- Identify anomalies in IAM policy bindings granting AdministratorAccess to standard accounts.
- Differentiate legitimate terraform/infrastructure automation from rogue manual console/API operations.
- Determine whether persistence keys were generated for exfiltration or long-term access.
