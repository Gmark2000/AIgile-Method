// Budget edition config defaults (JS fallback).
//
// Single source of truth for the budget edition lives in
// core/editions/budget.yaml. This module mirrors it so the budget strategy can
// still resolve correctly if the YAML file is ever missing from the package
// (same belt-and-braces pattern modelProfiles.js uses for the full edition).
//
// Beast-mode token optimization (ADR-001 §4): NO budget agent defaults to a
// Powerful-tier model (GPT-5.5) or to Claude Opus / Sonnet. Cheapest-correct
// tier per agent; premium models are escalation-only.
import { EDITION_BUDGET } from '../../shared/editions.js';

export const BUDGET_MODEL_PROFILE = 'budget-2026-06';

export const BUDGET_CONFIG_DEFAULTS = {
  editions: {
    profiles: {
      [EDITION_BUDGET]: {
        modelProfile: BUDGET_MODEL_PROFILE,
        mcpProfile: 'budget',
        promptProfile: 'budget',
        maxToolResultTokens: 800,
        subagentReturnTokens: 250,
        compressionSkill: 'agent-comms',
        costProfile: 'per-token',
      },
    },
  },
  models: {
    profiles: {
      [BUDGET_MODEL_PROFILE]: {
        default: 'GPT-5 mini',
        overrides: {
          'aigile-orchestrator': 'GPT-5 mini',
          'aigile-manual-orchestrator': 'GPT-5 mini',
          'aigile-budget-orchestrator': 'GPT-5 mini',
          analyst: 'GPT-5 mini',
          pm: 'GPT-5 mini',
          po: 'GPT-5 mini',
          sm: 'GPT-5 mini',
          'ux-expert': 'GPT-5 mini',
          'code-tour': 'GPT-5.4 nano',
          dev: 'GPT-5.4 mini',
          qa: 'GPT-5.4 mini',
          'automation-tester': 'GPT-5.4 mini',
          'ui-expert': 'GPT-5.4 mini',
          'expert-react-frontend-engineer': 'GPT-5.4 mini',
          'mvel-workflow-engineer': 'GPT-5.4 mini',
          devops: 'GPT-5.4 mini',
          security: 'GPT-5.4 mini',
          architect: 'GPT-5.4 mini',
        },
        escalation: {
          premium: 'Claude Opus 4.6',
        },
        // R5 — Model cascade (mirror of budget.yaml; asserted by validate-editions).
        cascade: {
          start: 'base',
          'on_guardrail_fail': 'tier++',
          'max_auto_escalations': 2,
          'premium_requires_user': true,
        },
        // R3 — Per-agent decoding tuning (mirror of budget.yaml).
        params: {
          'aigile-orchestrator': { reasoning_effort: 'low', verbosity: 'low', max_output_tokens: 400 },
          'aigile-budget-orchestrator': { reasoning_effort: 'low', verbosity: 'low', max_output_tokens: 400 },
          'aigile-manual-orchestrator': { reasoning_effort: 'low', verbosity: 'low', max_output_tokens: 400 },
          'code-tour': { reasoning_effort: 'low', verbosity: 'low', max_output_tokens: 300 },
          analyst: { reasoning_effort: 'low', verbosity: 'medium', max_output_tokens: 600 },
          pm: { reasoning_effort: 'low', verbosity: 'medium', max_output_tokens: 600 },
          po: { reasoning_effort: 'low', verbosity: 'medium', max_output_tokens: 600 },
          sm: { reasoning_effort: 'low', verbosity: 'medium', max_output_tokens: 600 },
          'ux-expert': { reasoning_effort: 'low', verbosity: 'medium', max_output_tokens: 600 },
          dev: { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 1200 },
          qa: { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 800 },
          'automation-tester': { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 800 },
          'ui-expert': { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 800 },
          'expert-react-frontend-engineer': { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 1000 },
          'mvel-workflow-engineer': { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 800 },
          devops: { reasoning_effort: 'medium', verbosity: 'low', max_output_tokens: 800 },
          security: { reasoning_effort: 'high', verbosity: 'low', max_output_tokens: 1000 },
          architect: { reasoning_effort: 'high', verbosity: 'medium', max_output_tokens: 1500 },
        },
        tiers: {
          'aigile-orchestrator': 'included',
          'aigile-manual-orchestrator': 'included',
          'aigile-budget-orchestrator': 'included',
          analyst: 'included',
          pm: 'included',
          po: 'included',
          sm: 'included',
          'ux-expert': 'included',
          'code-tour': 'included',
          dev: '1x',
          qa: '1x',
          'automation-tester': '1x',
          'ui-expert': '1x',
          'expert-react-frontend-engineer': '1x',
          'mvel-workflow-engineer': '1x',
          devops: '1x',
          security: '1x',
          architect: '3x',
        },
      },
    },
  },
};
