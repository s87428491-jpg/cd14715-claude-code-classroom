---
name: code-review-best-practices
description: Evidence-based code review principles for identifying actionable correctness, security, and maintainability issues.
---

# Code Review Best Practices

- Review changed behavior in context; prioritize defects over preferences.
- Tie each finding to concrete code and avoid assumptions unsupported by the diff.
- Describe impact, severity, and a specific remedy in plain language.
- Consider trust boundaries, input validation, authorization, error handling, resource use, and compatibility.
- Do not claim a vulnerability or test gap without a plausible execution path or missing behavior.
- Prefer the smallest behavior-preserving improvement and do not rewrite unrelated code.