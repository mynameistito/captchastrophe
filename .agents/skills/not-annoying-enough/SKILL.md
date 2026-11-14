---
name: not-annoying-enough
description: Get human feedback once a contestant's captcha is playable. Not a substitute for a playtest or a request to invent a premise.
---
# Not annoying enough

## Inputs
The playable entry, its intended frustration and payoff, and what has actually happened during play so far.

## Do
1. Ask the user to actually play it. Give the working local/preview URL and controls they need, without spoiling the payoff.
2. Derive a few useful questions from this specific interaction and what happened during play. Don't paste a canned questionnaire.
3. Use their observations to improve the frustration, surprise, pacing and payoff. “Worse” doesn't mean “longer.” Preserve their contribution.
4. Implement the agreed refinements and test the affected flow. Ask for another short play only when the change makes that useful.

## Stop / output
Record the feedback, the changes it caused and remaining concerns in the PR's playtest section. If the user explicitly waives the playtest, record the waiver. Silence isn't a waiver. If nobody has played, say “human playtest pending” and don't make up feedback.
