# Siyadah interaction language

This applies to public pages and the customer product. It describes how information is presented. It does not change the assistant's answer content or permission rules.

## First glance

Each surface should answer three questions within a few seconds: What is this? What is its current state? What can I do next? Use one headline, one primary action, and at most three immediately visible supporting signals. Reveal reasons, sources, and settings when requested.

## States

Use the same visible state vocabulary throughout Siyadah: proposed, ready to connect, awaiting approval, running, completed with evidence, and failed with a correction path. A draft, a saved connection, a provider response, and a customer-visible result remain distinct. State changes happen in place and are driven by real application data. Color and motion support the label; neither is the only signal.

## Motion

Motion marks a meaningful change: focus, selection, expansion, pending request, or a confirmed result. No perpetual motion in task surfaces. Respect `prefers-reduced-motion`; the full state stays readable without animation.

## By surface

| Surface | Immediate view | Revealed on interaction |
|---|---|
| Public site | One request and a visible path to a result | Company context, permission boundary, proof example |
| Account | One form and one next action | Field guidance, password visibility, error or pending state |
| Onboarding | Current step, progress, one decision | Source summary, employee fit, setup receipt |
| Employee and tools | Actual readiness and next needed action | Assigned permissions, connection requirements, run history |
| Conversation | User request and current task state | Plan, approval reason, evidence and source detail |
| Results | Outcome and status | Provider receipt, source, correction or retry |

The public site's illustrative sequence is explicitly labeled as an example. A live status appears only for a real run. Use [Cloudlight](https://pro.reactbits.dev/docs/templates/cloudlight-template) for presentation rhythm and [21st.dev AI Task List](https://21st.dev/@educalvolpz/components/ai-task-list) and [Source Citation Rail](https://21st.dev/@rmahammad/components/source-citation-rail) for meaningful state and evidence interactions. Do not add packages or effects solely to reproduce their look.

An external form response may confirm that a request was sent. It does not prove a seat, an email delivery, or a later customer outcome. Failure leaves the form visible with a correction path.
