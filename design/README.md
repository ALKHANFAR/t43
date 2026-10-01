# Siyadah design previews

These two HTML files are **illustrative local previews**, preserved from the integration worktree for review. They are not the live product, do not create an account or save settings, and do not prove a provider action. The source worktree was left unchanged.

| File | Scope | Current code to compare | Linear |
| --- | --- | --- | --- |
| `siyadah-ui-system.html` | Eight screens: site, account, onboarding, workspace, employee, tools, results, settings; Arabic/English and narrow layouts | `index.html`, `ar.html`, `auth.html`, `app/onboard.*`, `app/chat.*`; matching functionality must be checked screen by screen | ABO-54 for design index, ABO-44 for live UI |
| `employee-desk-preview.html` | Focused employee workspace concept | `app/chat.*`; illustrative states must be tied to the agreed API contract before implementation | ABO-54, ABO-37, ABO-44 |

The previews reference existing `../fonts.css`, `../siyadah-theme.css`, `../assets/wordmark.png`, and `../ar.html` in this repository. Serve the repository root locally to inspect them. The `#account`, `#workspace`, and `#employee` fragments select preview screens; they are not product routes.

An editable Siyadah Figma file, edit permission, and a node-to-code map have **not** been verified. Record the exact Figma URL and readback in ABO-54 before calling Figma the approved design source. Label any screenshot or review as a preview until real UI behavior is tested.

Original file SHA-256 at copy time:

- `siyadah-ui-system.html`: `d41a7849809b81adf929c88ecb44e6391723928d4f3c6ac319527c6f3296acc7`
- `employee-desk-preview.html`: `8659f985160330332b44662b8304ad12969b7505285ad34be5e2fa54e6dba625`
