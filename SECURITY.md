# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting flow:

**https://github.com/akhtar1985/anime-carousel/security/advisories/new**

Include:

- the affected file and version,
- a minimal reproduction (HTML + options) or a proof-of-concept,
- the impact you believe it has (for example DOM XSS through a rendered option, or an escape from
  an `inert` region).

You will receive an acknowledgement on GitHub as soon as the report is seen; fixes are targeted
within 7 days for high-impact issues. Credit is given in the release notes unless you ask otherwise.

## Scope

In scope: the distributed `src/`, `styles/` and `types/` folders, and the demo/docs pages hosted on
GitHub Pages.

Out of scope: findings that require an attacker to already control the page's JavaScript, missing
security headers on GitHub Pages (report those to GitHub), and social engineering.
