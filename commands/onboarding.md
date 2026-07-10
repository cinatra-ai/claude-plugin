---
name: onboarding
description: "Walk a new contributor from 'nothing installed' to 'working on a first issue': install this pack, run setup, get oriented, then find and start a first piece of work. A thin entry point into the onboarding skill so the newcomer how-to path keeps a dedicated / slash command now that skills are hidden from the picker."
argument-hint: "[optional: a specific onboarding question]"
disable-model-invocation: true
---

# /onboarding

Onboard a new contributor into the dev process. This command is a thin entry
point — the full walkthrough lives in the **`onboarding`** skill (which is
`user-invocable: false`, hidden from the `/` picker, so this command is its
dedicated slash entry).

1. Invoke the **`onboarding`** skill. It owns the ordered how-to path: install
   the pack, run `setup`, get oriented, then find and start a first piece of
   work, cross-linking the other skills in this pack.
2. If `$ARGUMENTS` names a specific onboarding question, answer that within the
   skill's framing rather than re-running the whole walkthrough.
