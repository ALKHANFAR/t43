# Workspace hierarchy — 8 October 2026

Local implementation on the current serving code baseline. This is a reviewable UI change, not final design approval or proof of a provider result.

## Reference and reuse

- Existing isolated `design/chat-craft.css` in the `codex/siyadah-ui-polish-20261006` worktree: reading width, calmer message spacing, rounded composer, optional evidence. Adapted the intent into the current app's tokens; no simulated conversation state copied.
- Existing `design/vendor/README.md` and `design/vendor/tailark/integration-card.tsx`: icon/title/description hierarchy, public MIT source at https://github.com/tailark/blocks/tree/main/registry/bases/base. The CSS here is independently written for the existing DOM; no React component or new dependency copied.
- The previous 21st.dev AI Agent Pipeline was a visual reference whose source was private. This change does not claim to install that component. User-supplied ToolCallsSection remains in the isolated preview pending a real typed payload integration.

## Applied

Quieter sidebar selection; a consistent 740px reading column; calmer messages and input focus; employee, result and tool card spacing; numbered published workflow steps with existing branch labels. Responsive rules use logical properties for RTL/LTR. No new animation; reduced-motion override retained. All result and connection semantics remain unchanged.

## Acceptance

Runtime and static checks are local evidence. Actual Chrome desktop/mobile review and human design approval remain separate; the integration owner performs them on the assembled branch.
