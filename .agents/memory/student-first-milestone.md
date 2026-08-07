---
name: Student-first milestone
description: Scope and boundary decisions for the first Attenda mobile milestone.
---

The first usable Attenda milestone is a student-only Expo experience with local device persistence. It intentionally covers certified registration, login, student profile, profile photo selection with an admin-configurable-style upload limit, attendance history, settings, and logout before the shared backend and staff tools exist.

**Why:** The capstone brief makes the event QR code an admin-controlled artifact and explicitly forbids showing, generating, scanning, downloading, or sharing it in the student portal. Shipping the student surface first makes that security boundary visible instead of inventing a student QR workflow.

**How to apply:** Keep future student routes limited to the student's own account and attendance records. Build admin event/QR management and officer scanning as separate role-protected surfaces backed by shared server-side attendance validation.