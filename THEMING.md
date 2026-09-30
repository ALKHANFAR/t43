# Siyadah appearance contract

The current public and customer pages load `siyadah-theme.css` before their page CSS. The shared file defines visual roles; each page keeps its own layout. `data-theme="siyadah"` names the current appearance. A future theme adds a scoped set of values for the same roles and changes `data-theme`; it should not fork the pages or their behavior.

## Scope

`index.html`, `ar.html`, `auth.html`, `integrations.html`, `demo.html`, `demo-en.html`, `privacy.html`, `404.html`, `app/chat.html`, and `app/onboard.html` load the shared tokens. `developer-lab` is an isolated internal tool and is outside the customer theme.

## Roles

- Surfaces and text: `--paper`, `--wash`, `--ink`, `--ash`, `--hair`.
- Action and progress: `--accent`, `--accent-lt`, `--accent-wash`, `--accent-edge`, `--on-accent`.
- Form and state: `--field-edge`, `--error`, `--error-wash`, `--warn`, `--bad`, and their related values.
- Account story: `--story-*` values. The account scene may be dark while the form remains light.
- Type and motion: `--f-display`, `--f-body`, `--radius-control`, `--ease`.

Keep status meanings tied to server state, permissions, and evidence. A color change cannot turn a draft into an executed result. Error and warning colors remain distinct in every theme.

## Adding a theme

1. Add a named selector such as `html[data-theme="name"]` in the shared stylesheet and supply values for the existing roles.
2. Check contrast in both languages, account states, onboarding, chat, and marketing sections at 360px and desktop size. Check keyboard focus and reduced motion.
3. Add a selection control only after the new appearance is complete. Persist the choice and apply it before first paint to avoid a flash.
4. Keep the original Siyadah wordmark and mark unless a new asset has been explicitly approved. Review logos and illustrations against every surface.

The 21st.dev split layout informed the account composition. [Cloudlight's documentation](https://pro.reactbits.dev/docs/templates/cloudlight-template) informed the public site's future presentation order and theme readiness. Its WebGL and animation code are not dependencies of this implementation.
