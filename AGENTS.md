# Codex Instructions — Token Efficient Mode

## PRIMARY GOAL
Minimize token usage while producing clean, correct code.

---

## SESSION BEHAVIOR (MANDATORY)
- Work step-by-step
- ONLY process code provided in prompt
- DO NOT assume full project context
- DO NOT process entire codebase
- DO NOT rewrite full files
- Return ONLY modified or relevant parts

---

## OUTPUT RULES (STRICT)
- Max 80 lines per response
- No explanations unless explicitly requested
- No unnecessary comments
- Prefer diff-style or minimal snippets

If response exceeds 80 lines:
→ STOP and ask user to continue

---

## INPUT HANDLING
- Ignore unrelated code
- Focus only on relevant section
- Do NOT restate input
- Do NOT summarize large inputs

---

## TASK EXECUTION
- Break large tasks into steps
- If request is broad → ask for clarification
- Do NOT perform full refactors unless explicitly asked

---

## RESPONSE STYLE
- Keep answers short
- No repetition
- Prefer code over text

---

## DEFAULT ASSUMPTIONS
- User wants minimal output
- User prioritizes performance and efficiency