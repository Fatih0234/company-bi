# Report Story Schema

Before creating slides, extract the report into a story model.

## Required output path

```text
reports/<slug>/slides/story.json
```

## Schema

```json
{
  "schema_version": 1,
  "deck_title": "",
  "analysis_slug": "",
  "source_report": "pages/report.md",
  "source_workspace": ".cmux/workspace.json",
  "audience": "",
  "density": "speaker-led|reading-first",
  "business_question": "",
  "decision_context": "",
  "one_sentence_answer": "",
  "narrative_arc": "",
  "key_findings": [
    {
      "id": "finding-1",
      "claim": "",
      "supporting_evidence": "",
      "chart_or_query_reference": "",
      "suggested_visual": "",
      "business_implication": "",
      "confidence": "high",
      "caveat": ""
    }
  ],
  "recommendations": [
    {
      "recommendation": "",
      "rationale": "",
      "owner_or_audience": "",
      "urgency": "",
      "dependencies": ""
    }
  ],
  "risks_and_caveats": [
    {
      "caveat": "",
      "impact_on_interpretation": "",
      "how_to_phrase": ""
    }
  ],
  "evidence_sources": [
    {
      "type": "report-section|query|chart-screenshot|data-profile|manual-note",
      "path": "",
      "description": ""
    }
  ],
  "appendix_material": [
    {
      "title": "",
      "source": "",
      "reason": ""
    }
  ],
  "assumptions": [],
  "open_questions": []
}
```

## Extraction rules

### Business question

Look for:

- report title
- workspace brief
- "Goal"
- "Question"
- "What we investigated"
- "Why this matters"
- first paragraph of the report

If ambiguous, infer the most likely question but record it in `assumptions`.

### One-sentence answer

This must be a plain-language answer suitable for an executive.

Bad:

> Revenue varies by segment and time.

Good:

> Revenue quality is strongest in enterprise renewals, but growth is being diluted by low-margin expansion in two mid-market segments.

### Key findings

A finding is not just an observation. It must include business implication.

Bad:

> Segment A has 42% of revenue.

Good:

> Segment A contributes 42% of revenue but only 23% of margin, making it the primary dilution risk.

### Caveats

Caveats should be phrased as decision limits, not defensive disclaimers.

Bad:

> Data may be incomplete.

Good:

> Treat month-over-month movement after May as directional because late-arriving records are still being backfilled.

### Recommendations

Only include recommendations justified by the findings.

If the report does not support a recommendation, use:

```json
"recommendations": [
  {
    "recommendation": "No immediate action recommended; use this deck to align on the diagnostic finding and next validation step.",
    "rationale": "The current report supports diagnosis but not intervention priority.",
    "owner_or_audience": "Decision owner",
    "urgency": "after next validation",
    "dependencies": "additional analysis"
  }
]
```

## Evidence traceability

Every key finding should reference at least one of:

- report section heading,
- SQL query file,
- chart screenshot asset,
- table name,
- data profile,
- manual user-provided assumption.

If traceability is weak, mark confidence as `medium` or `low`.
