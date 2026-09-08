export interface Example {
    id: string;
    name: string;
    text: string;
    expected?: string;
    lesson: string;
}
export const EXAMPLES: Example[] = [
    { id: 'business', name: '01 / Verbose business brief', lesson: 'Repeated context and verbose phrases can be reduced; instruction and numeric constraints should survive.', text: `The planning team is preparing a short update for the leadership group. The update is intended to provide a general overview of progress and current concerns. The planning team is preparing a short update for the leadership group.

At this point in time, the team meets on a daily basis in order to share progress. There is a large number of routine discussions about work already completed. Due to the fact that several discussions overlap, the background material repeats itself. There is a large number of routine discussions about work already completed.

The project has a budget of $80,000 and a deadline of October 15, 2026. The current risk is a delayed integration test.

Write a concise leadership update with progress, the integration risk, and the next action. Do NOT invent a completion date. Keep all numbers and dates unchanged.` },
    { id: 'redundancy', name: '02 / Redundancy stress test', lesson: 'Exact duplication is not the same as useful emphasis. Protected instructions are intentionally not deduplicated.', text: `The garden planner helps beginners organize their planting tasks. The garden planner helps beginners organize their planting tasks. The garden planner helps beginners organize their planting tasks.
The interface is simple and easy to follow. The interface is simple and easy to follow.
The context is provided for background only. The context is provided for background only.
Write a one-sentence description of the product. Do NOT promise automatic plant identification.` },
    { id: 'rag', name: '03 / RAG-style context', lesson: 'A relevant fact may be only a small part of a long context; a global similarity score is not a retrieval-quality guarantee.', text: `Background: the support team has used several internal workflows over the years. Old process descriptions often include information that is no longer important. General context helps orient the reader but can also distract from the question.
Record A: refunds are available within 14 days of purchase.
Record B: damaged products qualify for replacement within 30 days.
Record C: gift cards are NOT refundable.
Additional background: routine questions are answered during normal business hours. The support team tries to make the experience straightforward.
Answer only from these records: can a customer receive a refund for a gift card?` },
    { id: 'negation', name: '04 / The negation trap', lesson: 'Removing NOT can reverse a decision while leaving most of the words unchanged.', text: `The environment is a routine test setup with several ordinary maintenance tasks. The context is provided for background only. The context is provided for background only.
Do NOT delete the database. Do not execute any action.
Return exactly BLOCK if deletion is prohibited; otherwise return ALLOW.`, expected: 'BLOCK' },
    { id: 'json', name: '05 / Structured JSON', lesson: 'This MVP preserves complete valid JSON verbatim rather than claiming that schema-breaking deletion is safe.', text: `{
  "task": "create_summary",
  "max_words": 80,
  "include_personal_data": false,
  "required_fields": ["progress", "risk", "next_action"],
  "instructions": "Do NOT invent missing values."
}` },
    { id: 'code', name: '06 / Code + instruction', lesson: 'Code, indentation, identifiers and explicit requirements need stronger protection than generic prose.', text: 'The following function is part of a small teaching example. At this point in time, it is provided in order to discuss edge cases.\n\n```python\ndef divide(a, b):\n    if b == 0:\n        return None\n    return a / b\n```\n\nExplain the behavior when b is zero. Do NOT rewrite the function. Preserve the identifier `divide`.' },
    { id: 'math', name: '07 / Multi-step arithmetic', lesson: 'The answer, not just the embedding, is the actual downstream target.', text: `This is a simple arithmetic exercise with some repetitive background. This is a simple arithmetic exercise with some repetitive background. The surrounding text is only here to make the exercise more verbose.
Calculate (12 + 8) * 3. Return only the final integer.`, expected: '60' },
    { id: 'long', name: '08 / Longer context', lesson: 'Long inputs are chunked using the embedding tokenizer. No score is computed from only a silently truncated prefix.', text: Array.from({ length: 24 }, (_, i) => ['The background describes routine planning discussions and ordinary team coordination.', 'At this point in time, the team reviews progress in order to understand the next steps.', 'General context may help the reader but should not replace the final instruction.'][i % 3]).join('\n') + '\n\nThe actual delivery deadline is November 10, 2026. Return only the delivery deadline exactly as written. Do NOT include other dates.', expected: 'November 10, 2026' },
];
