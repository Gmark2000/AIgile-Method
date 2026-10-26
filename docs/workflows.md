# Deterministic Local Workflows

This is a local scheduler, not an agent host. It parses strict YAML, freezes definitions and inputs, checks artifact bytes, and accepts one revision-bound transition at a time. Identical state and accepted input (including referenced file bytes) choose the same next step. Run IDs are random; LLM work, human decisions, tests and external tools are not deterministic. No command executes an agent, shell from YAML, server, Jira request, push or PR operation.

These changes are local and unreleased; version remains 1.5.0. `aigile` below means this checkout's CLI, not a promise of npm availability. In Windows Git Bash, from your target workspace:

```bash
aigile() { node 'C:/Users/mark.gozner/GM/AI/public-req2code/tools/cli.js' "$@"; }
aigile workflow list --host copilot
aigile workflow create bug-resolve-wf --from bug-resolve
aigile workflow validate bug-resolve-wf
aigile workflow graph bug-resolve-wf
aigile workflow run bug-resolve-wf --issue PROJ-123 --host copilot
aigile workflow status RUNID --host copilot
aigile workflow scaffold-result RUNID --kind result --out evidence/pm-result.json
aigile workflow advance RUNID --result evidence/pm-result.json
aigile doctor
```

Bundled deterministic templates:
- `bug-resolve`: PM scope (`scope`) → Dev implementation (`fix`, scope approval) → QA verification (`review`) → DevOps draft PR (`draft-pr`, publish approval)
- `feature-delivery`: PO story (`story`) → Architect design (`design`) → Dev implementation (`implement`, scope approval) → QA verification (`verify`) → Security audit (`audit`) → DevOps draft PR (`draft-pr`, publish approval)
- `security-remediation`: Security triage (`triage`) → Dev remediation (`remediate`, scope approval) → QA verification (`verify-fix`) → DevOps draft PR (`draft-pr`, publish approval)
- `pr-quality-gate`: Architect review (`architecture-check`) → Security review (`security-check`) → QA quality verdict (`quality-verdict`)

Replace `RUNID` with the returned `runId`. The template defaults to `snapshotPaths: [src]`. Before running, edit it to name every relevant existing code/test/config path, or create with `--snapshot-paths src,test,package.json`. Missing paths block the run. Never include credentials. Only declared paths are covered, not the whole Git tree or remote HEAD.

Name lookup checks `.aigile-workflows/custom/NAME.yaml` first, then legacy `.aigile-workflows/NAME.yaml`, then the named bundled template. An invalid higher-priority definition fails validation rather than falling through. Validation/status expose the chosen `source.path` and SHA256. All create modes save in the dedicated `custom/` folder without overwriting; `create --from` always copies the bundled template. Existing definitions are not moved or deleted, and existing runs keep their frozen source. The six original prose workflows remain unchanged and available through existing host workflows; this strict runner never silently accepts them.

## Custom Definitions

In VS Code Chat, select **Workflow Creator** in the agent picker. The installer exposes `.github/agents/workflow-creator.agent.md` with that exact name and user invocation enabled; both coordinators allow routing to it. Ask: "Create a review workflow with QA and Security, save it in the custom folder, validate and preview it; do not run it." The agent authors and validates only, then returns the path and invocation for a separately approved run. File metadata and installer tests verify the discovery contract, not whether an already-open host session has loaded it.

```bash
aigile workflow create feature-delivery --steps pm,architect,dev,qa,devops
aigile workflow create review-pipeline --steps dev,qa,security
aigile workflow create custom --definition proposals/custom.yaml
aigile workflow validate custom
```

`--steps` is a local scaffold, not a publication-ready policy. Generated `dev` and `expert-react-frontend-engineer` stages declare `writesCode: true`; a following QA stage reviews code, and a following DevOps stage requires that review. No generated stage authorizes publication. Review instructions and add any required scope approvals. Code pipelines default to existing `src`; override with `--snapshot-paths` for repositories without it. **Workflow Creator** can author and validate arbitrary ordered pipelines. Copilot/Codex targets come from canonical identities, including **Security Engineer** and **Workflow Creator**; Claude uses canonical aliases. Manual or unsupported host routing returns `delegationTarget: null` and `manualDelegationRequired: true`, never a guessed exact target.

Executable custom pipeline (from a workspace containing `lib`):

```bash
aigile workflow create two-writers --steps dev,dev,qa,devops --snapshot-paths lib
aigile workflow validate two-writers
aigile workflow run two-writers --host copilot
aigile workflow status RUNID --host copilot
aigile workflow advance RUNID --result evidence/dev-1-result.json
aigile workflow status RUNID --host copilot
aigile workflow advance RUNID --result evidence/dev-2-result.json
aigile workflow status RUNID --host copilot
aigile workflow advance RUNID --result evidence/qa-result.json
aigile workflow status RUNID --host copilot
aigile workflow advance RUNID --result evidence/devops-result.json
```

Each authorized worker performs only its current step, writes the declared evidence files, then fills the refreshed `next.resultTemplate` as described below. Refresh status after each writer's code changes to obtain the new snapshot. QA and DevOps may not change covered code. These commands make no branches, pushes or PR calls.

Minimal strict schema:

```yaml
schemaVersion: 1
workflow:
  id: review-pipeline
  name: API Review
  description: Review an approved proposal.
  inputs:
    proposal:
      type: file
      required: true
      description: Workspace-relative proposal file.
  snapshotPaths: []
  sequence:
    - id: review
      agent: qa
      instructions: Review the supplied proposal and record findings.
      requires: ['input:proposal']
      creates: [review-report]
      capabilities: [manual-review]
      guard: evidence
      approval: none
      maxRetries: 2
      binding: none
```

All shown fields are required; optional `writesCode` must be boolean and defaults to false. Input types: `string`, `number`, `boolean`, `file`; workflow/step/input/evidence IDs must be safe lowercase string identifiers. `requires` references earlier evidence or `input:NAME`. Exactly one known alias owns each step. Unknown keys/guards, expressions, forward references, duplicate IDs, YAML aliases, unknown tags and parser warnings fail. Standard YAML scalar tags such as `!!str` are supported. No branches, loops or automatic skips.

Guards: `evidence` requires files/hash attestations; `reviewed-code` requires independent review of prior code-bound evidence and pass verdict; `qa-pass` requires independent reviewed-code pass evidence. `binding: code` checks the declared snapshot. Approval: `none`, `scope`, `publish`; publication requires code binding and `qa-pass`. Explicit retries are bounded to 0..5 per step (bug template: two). Capability strings are requirements for workers, not tool registrations or proof of installed servers.

`writesCode: true` is independent of agent identity and is permitted only with `binding: code` and `guard: evidence`. It permits a new contribution snapshot without pretending older contribution snapshots are current. All historical artifact hashes remain checked. Nonwriters must match the latest successful writer's snapshot. With no writer, an earlier code-bound evidence step may establish an initial snapshot for independent review. Review must follow the latest writer and match its code. Any later successful writer invalidates that review for `qa-pass` and publication, even if the bytes are identical or restored. Publication needs a new review and new approval. Scope approval checks the previous frontier before permitting writer changes; the marker cannot bypass review guards.

Review independence covers the latest declared writer and every declared writer since the preceding independent review, across the workflow's entire `snapshotPaths` scope. The first review covers all preceding writers. Selecting only older evidence in `requires` cannot exclude contributions; explicit evidence producers must also differ from the reviewer. A `dev` writer followed by a `security` writer cannot be certified by `security` reviewing only dev evidence; a nonwriting `qa` role can review both. Prior independent review settles earlier contributions, but never makes the latest writer eligible to certify its own code. Roles are canonical aliases, not arbitrary display names. These checks do not establish distinct people or prevent one person attesting through multiple roles.

## Inputs And Results

`--inputs FILE` accepts JSON for arbitrary fields. `--issue` is convenience only for a declared `issue` input. To use an exported Jira issue, author a workspace JSON file:

```json
{"issue":"PROJ-123","issue-export":"evidence/jira-export.json"}
```

```bash
aigile workflow run bug-resolve-wf --inputs evidence/inputs.json
```

PM reads the supplied export or checks authorized Jira-read availability. Neither available means the worker returns a blocker. The scheduler never contacts Jira. Inputs are frozen, and file inputs retain hashes. Later definition edits cannot change an existing run.

`status` returns `next.resultTemplate`, `next.approvalTemplate`, role, inputs, required outputs, missing-capability warnings, evidence and code snapshot. Write a submission using the current template. Example first PM result:

```json
{
  "expectedRevision": 0,
  "attemptId": "scope:1",
  "step": "scope",
  "status": "succeeded",
  "outputs": {
    "bug-brief": {"path":"evidence/bug-brief.md","sha256":"<64 lowercase hex>"},
    "reproduction": {"path":"evidence/reproduction.md","sha256":"<64 lowercase hex>"},
    "acceptance": {"path":"evidence/acceptance.md","sha256":"<64 lowercase hex>"}
  }
}
```

Compute actual file hashes using Git Bash `sha256sum evidence/bug-brief.md` or PowerShell `Get-FileHash -Algorithm SHA256 evidence/bug-brief.md` (lowercase the hash). The scheduler never writes artifact files. All declared outputs are required. Code-bound results also require `codeSnapshot`; review/publication results require `verdict: pass`. Invalid hashes, missing outputs, stale revision/attempt, future steps, missing approval or changed QA code reject without changing run JSON bytes.

Evidence and approvals are **attestations**. File existence, byte identity and ordering are checked, not whether tests truly ran, consent was authentic, reviewers were independent people, or a PR exists. Workers must record actual commands, outcomes and reviewed scope. A local file owner can fabricate evidence or rewrite all state; this is not authentication or a tamper-proof audit.

## Approvals And Publication

After PM succeeds, `fix` waits for scope approval. Author its current `approvalTemplate`, for example:

```json
{
  "expectedRevision": 1,
  "attemptId": "fix:1",
  "step": "fix",
  "codeSnapshot": "<current status snapshot>",
  "scope": {
    "repository": "org/repo",
    "base": "main",
    "head": "fix/proj-123",
    "proposedChanges": "Correct approved bug and regression tests",
    "pushScope": "none"
  }
}
```

```bash
aigile workflow advance RUNID --approve fix --result evidence/scope-approval.json
aigile workflow status RUNID
```

Approval increments the revision: refresh status before submitting results. It binds the current attempt and starting snapshot while permitting approved developer edits. The worker enforces natural-language change scope; retry clears approval.

After developer evidence and QA pass, author a **fresh** `draft-pr` approval using the current revision, attempt and snapshot. Name repository/base/head/proposed changes and `pushScope: branch:<head>`; head must differ from base. Publication approval binds the reviewed code. Code changes require retry/review/new approval. Successful results cannot bypass it.

```bash
aigile workflow advance RUNID --approve draft-pr --result evidence/pr-approval.json
aigile workflow status RUNID
```

Only an authorized worker may perform the separately approved branch push and single draft PR action within host policy. It checks capabilities and authority first; `readyForAuthorizedWorker` grants nothing. Add this property to a complete current result template:

```json
{"publication":{"url":"https://github.com/org/repo/pull/123","repository":"org/repo","base":"main","head":"fix/proj-123","draft":true}}
```

Repository/base/head must match approval. The runtime never resolves branches, checks remote HEAD, or validates that URL exists. It never implicitly creates a branch, pushes, publishes or merges.

## Failure And Recovery

Submit `status: failed` with current revision, attempt, step and nonempty `reason`. QA failure stops and requires its declared output artifacts, current `codeSnapshot` and `verdict: fail`; use `next.failureTemplate`. Missing earlier evidence or changed code does not prevent recording failure against the current observable snapshot; it cannot certify success. If snapshot paths themselves are unavailable, record an uncertain outcome and reconcile before retry. Publication failure additionally needs `outcome: not-performed` and a hash-backed `reconciliation` artifact; otherwise submit `uncertain`.

```bash
aigile workflow advance RUNID --result evidence/qa-failure.json
aigile workflow advance RUNID --retry fix --expected-revision 4
```

Use the actual revision, not necessarily `4`. Retry current/earlier steps only. It consumes that step's retry budget, changes attempt IDs, and invalidates downstream results/approvals while preserving user artifact files. Recorded successful publication cannot be retried in this run. Changed input files need a new run; changed code needs retry of the producing step, re-review and new publication approval.

For unknown external outcomes submit `uncertain` and a reason. Retry is blocked until reconciliation. Inspect remote state manually under separate authority; submit revision/attempt/step, `outcome: not-performed`, and `reconciliation: {path, sha256}` to enter failed state before retry. For performed work submit `outcome: performed`, reconciliation artifact and complete succeeded result including the retained approved PR scope and matching code. Never guess or repeat blindly.

Once publication approval is issued, retry is blocked even while status still says `ready`: the worker could have acted and lost its response. Use the same reconciliation command directly from that approved state before any retry. Existing approval is retained for performed reconciliation, or cleared for evidence-backed not-performed reconciliation.

```bash
aigile workflow advance RUNID --reconcile draft-pr --result evidence/reconcile.json
```

If performed work cannot match retained approval/code, leave the run blocked and resolve it manually. No automatic bypass exists.

## Storage And Security

- User definitions belong in `.aigile-workflows/custom/`, shipped templates remain in `.aigile-core/workflows/deterministic/`, and state remains in `.aigile-workflows/runs/`. Custom and legacy definitions and runs are outside installer ownership and survive install, update and uninstall. Creation is exclusive. Local `.aigile-workflows/.gitignore` ignores `/runs/`; an existing file lacking that line is preserved and must be updated by its owner. No root/global ignore changes.
- Windows persistence uses a fixed packaged PowerShell/.NET helper with JSON data on stdin, not interpolated workflow commands. Local unencrypted NTFS is required. New state/locks are owner-only protected files. Under the exclusive lock, capture original identity, bytes, owner/group and DACL; apply and verify the exact descriptor and inheritance flags on empty staging before writing bytes. Flush staging, recheck identity/security, then use strict native replacement without ignored metadata errors, backup files or in-place fallback. Unsupported filesystems or insufficient rights fail closed with an actionable error. Real Windows regressions cover inherited ACLs and protected owner-only ACLs, exact SDDL/owner equality and injected helper failure. SACL auditing, hostile concurrent namespace changes and distributed locking are not claimed.
- POSIX staging preserves existing owner/group/mode before writing or refuses; new files and locks request `0600`. File data and directory commit boundaries are flushed. These are single-file commits, not a transaction over artifacts, definitions and state; no blanket power-loss or all-files atomicity guarantee. Windows read-only state is refused. The current Windows validation skips the POSIX-specific regression.
- A crash can leave `.lock`/`.tmp` files. Stop writers, preserve state/evidence, establish any external outcome, manually remove only a confirmed abandoned lock/temp, then inspect status. No stale-lock stealing. Never remove a live lock or infer permission to repeat a PR.
- Absolute paths, traversal, alternate streams, symlinks and junctions are rejected. External definitions, inputs, submissions, evidence and snapshots exclude `.git` and `.aigile-workflows` path segments, case-insensitively on Windows and case-sensitively on POSIX. Same-prefix ordinary files remain valid. Snapshot hashes cover selected directory/file names and bytes, including untracked files. Uncovered files, permissions, Git metadata and remote commits are not covered. This is not a sandbox against hostile concurrent filesystem replacement; use a trusted, access-controlled workspace.
- JSON/YAML/persisted files are bounded to 1 MiB, artifacts to 16 MiB, snapshots to 64 MiB/10000 entries. Structured depth, prototype keys, aliases and counts are bounded. Never include credentials or environment dumps. The runtime reads no environment/home configuration but cannot reliably detect user-authored secrets in arbitrary text.
- A shared deep consistency validator runs before status/advance and before persistence: frozen source/inputs/schema, exact attempts/retries, legal successful prefix, output shapes/hashes, exact revision history, current and retained approvals, guarded verdicts, contribution/review snapshots and publication scope. State format 2 retains an append-only journal of typed `approve`, `result` (including failed/uncertain), `reconcile` and `retry` events. Each accepted mutation increments revision once; sequential event revisions and result/approval envelopes must replay to exactly the stored state. Retry invalidation does not erase historical results or approvals. The journal is bounded by the existing persisted-data limits and has no cryptographic chain; an owner forging an entirely consistent history is outside the guarantee. Live missing artifacts or byte drift are separate blockers so failure/retry/reconciliation remain available.
- Existing format-1 run files are rejected explicitly and never silently migrated or rewritten: their discarded retry/approval history cannot prove exact revisions. Preserve those files and artifacts, establish any issued publication outcome manually, and explicitly start a replacement run only under fresh authority. Workflow YAML remains `schemaVersion: 1`; the package version remains unchanged.
- Workflow Creator returns a validated brief to its user/parent and never spawns agents, including when selected directly. Copilot and Claude retain explicit authoring/validation tool lists. Kiro maps canonical read/search to `read`, edit to `write`, and execute to `shell`, using the [official tool categories](https://kiro.dev/docs/custom-agents/configuration-reference/#tools-field); it adds no delegation, wildcard built-ins, MCP/power inheritance or automatic approval. Explicit nondelegating roles and explicit tool lists without delegation use this restricted conversion. Codex and Antigravity preserve the role's nondelegation instructions, but do not provide a generated per-role permission sandbox; inherited host policy still controls actual tools. Shell availability cannot prove absence of external side effects: only authorized local validation is permitted by the role instructions.
- Pure coordinators delegate authoring to Workflow Creator and CLI operations to Full Stack Developer / aigile-dev. Manual coordinators confirm every delegation. Workers lacking nesting return briefs/questions to parents. Workflow content is untrusted and cannot override system/host/tool policy. Native `/goal` remains unchanged.