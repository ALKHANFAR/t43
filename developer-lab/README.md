# Siyadah Developer Lab

Local-only prompt and agent-behavior comparison. It does not import the production server, database, tenant sessions, or Activepieces.

1. Put a development-only `DEEPSEEK_API_KEY` in the local shell.
2. Edit `context.json` with sanitized test data.
3. Run `npm run lab` and open `http://127.0.0.1:8766`.
4. Compare the three variants and export the winner as a change-request JSON.

The server binds to localhost and refuses to start when Railway or `NODE_ENV=production` is detected. Choosing a winner never changes production.

## Company knowledge answer-quality evaluation

`node scripts/knowledge-quality-eval.mjs` runs 7 synthetic scenarios through the **real production chat loop** in both main and employee contexts (14 cases), using a scripted reply solely to capture the actual retrieved context. This reports `retrieval_only`, zero model cases and no answer score. It covers current and historical prices, an older fact beyond the first 40 rows, aggregation, missing information, equal-source conflict and selected-employee memory isolation. AP tables are synthetic read-only fixtures; no AP provider calls or SQL writes occur.

With `DEEPSEEK_API_KEY` already available through a secure process environment, run `node scripts/knowledge-quality-eval.mjs --live`. This sends synthetic data to DeepSeek V4 Pro using production thinking settings, capped at 4096 output tokens and 3 model calls per case. It costs model API usage. It never uses live AP or customer data. The CLI emits per-case context checks, exact answer/status/evidence checks, actual model identifier and token counts, with no key or raw reply logging. Unsupported answers, wrong citations and unknown/conflict statuses containing a definitive answer fail. Unknown keys produce `live_unavailable`; provider/timeout/call-budget failures produce `live_incomplete`, never a pass. Exit 0 means the selected mode completed its checks, 1 a quality/context failure, 2 unavailable/incomplete/configuration error.

These are small deterministic Arabic ground-truth cases, **not** LongMemEval/Mem0 benchmark scores, a prose-quality judge, end-to-end production execution proof or a general accuracy guarantee. Source ideas: [LongMemEval](https://arxiv.org/abs/2410.10813), [Mem0](https://arxiv.org/abs/2504.19413). Add representative sanitized company cases before a release claim. The test runner uses the existing source-extraction/VM harness style; it does not alter production model or dispatch code.

## Employee stress simulation

Run `node scripts/employee-stress-eval.mjs --live` with a process-only DeepSeek key. Fourteen scenarios in both chats (28 cases) retain all basic checks and add 180 distracting facts, document prompt injection, negation/currency, scoped prior-task history, acceptance versus delivery, native table discovery, paid-only aggregation, a transient read failure and one simulated published flow followed by exact run readback. The employee-flow fixture supplies a matching active employee, published version and server-owned project; no production checks are bypassed.

Success requires exact answer/status/evidence plus necessary tool traces, no duplicate execution, and independently read results. The actual production loop and live model run against synthetic MCP/project/profile services. AP/provider business operations, SQL writes and real delivery never occur. This does not prove actual published deployment, UI experience, throughput or latency. Up to eight model calls per workflow and 120 seconds per case; API usage costs apply. Offline mode scores retrieval only.

Citation contract: `evidence_keys` must contain literal `key`/`evidence_key` values, without topic/scope prefixes. Diagnostic live repeats found correct values cited as `offices:jeddah` and `pricing:old_price`; the request now states the exact format. The scorer remains strict and rejects prefixed or incomplete evidence. This clarifies the evaluation request, not the production prompt. Earlier live failures remain in Git history and the later report links its predecessor.
