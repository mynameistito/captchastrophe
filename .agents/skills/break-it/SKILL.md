---
name: break-it
description: Adversarially play an implemented captcha in a local or authorized preview. Not production bot-protection testing.
---
# Break it

## Inputs
Playable URL, intended rules, success condition and deliberate loopholes if the user has named any.

## Do
1. Give an independent subagent the URL and intended behavior. Ask it to play, looking for ordinary interaction shortcuts, invalid transitions and unintended ways to pass.
2. Require reproducible steps, expected versus actual behavior and impact. Speculation isn't a finding.
3. Separate ordinary interaction bypasses from rewriting client-side code in devtools. This is a browser toy, not production bot protection.
4. Review the findings. If a loophole might be deliberate, check intent before removing it. Don't sand off the joke to satisfy a security checklist.
5. Fix unintended bypasses and rerun the affected behavior. Preserve the premise and the achievable success condition.

If independent agents aren't available, do a separate adversarial pass yourself and disclose that limitation. Don't claim independence you didn't have.

## Stop / output
A short list of reproducible findings, fixed/intentional/unresolved status and retest evidence. Stop when the affected cases are retested, or name the missing access preventing it. No impossible client-side tamper-resistance requirement.
