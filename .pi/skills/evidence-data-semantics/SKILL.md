---
name: evidence-data-semantics
description: Reason safely about Evidence data sources, metrics, dimensions, source SQL, and dashboard assumptions. Use when defining metrics, interpreting columns, choosing measures/dimensions, writing derived queries, or deciding what the data can support.
---

# Evidence Data Semantics Skill

Use this skill when the task depends on what the data means, not just how the page is laid out.

## Safety boundaries

Allowed by default:

- Read `sources/*/*.sql`.
- Read dashboard pages and query files under `pages/**` and `queries/**`.
- Read `.cmux/workspace.json` and `.cmux/evidence.json` for workspace intent and policy.
- Use the dynamic source catalog injected by `.pi/extensions/evidence-context.ts` as a starting point.

Do not read:

- `.env*`
- `**/connection.yaml`
- credential files
- raw data files unless the project explicitly adds a safe profiling workflow

Ask before editing:

- `sources/**`
- shared semantic/data-source files
- dependencies or package metadata

## Semantic reasoning rules

- Treat inferred column classifications as hints, not facts.
- Verify column names and query definitions from safe SQL files before relying on them.
- Distinguish clearly between:
  - verified source behavior
  - reasonable inference
  - business assumption
  - unknown/needs user clarification
- Do not invent business definitions for metrics such as revenue, churn, active user, completed trip, conversion, or margin.
- If a metric can be interpreted multiple ways, ask or present options.
- Prefer transparent derived queries over clever opaque SQL.
- Put important assumptions into dashboard narrative or the visible `Workspace Brief`.

## Metric definition checklist

For each important metric, identify:

- business name
- source query/table
- calculation
- time grain
- filters/exclusions
- dimensional cuts
- known caveats

Example output:

```text
Metric: Average fare per trip
Verified source: sources/tlc/trips.sql exposes fare_amount and trip_count-like fields/rows.
Calculation: sum(fare_amount) / count(*) unless a pre-aggregated trip count exists.
Assumption: one row represents one trip.
Needs confirmation: whether cancelled/invalid trips are excluded upstream.
```

## Query design workflow

1. Start from the user question and workspace intention.
2. Identify relevant safe source SQL files.
3. Verify available columns and grains.
4. Define metrics and dimensions explicitly.
5. Write the simplest query that supports the dashboard section.
6. Use names that make Evidence components self-explanatory.
7. Add visible notes when definitions are assumptions.

## Evidence-specific reminders

- Evidence SQL fences should be named, e.g. ```` ```sql daily_metrics ````.
- Components reference query results by name, e.g. `data={daily_metrics}`.
- Prefer dashboard-ready query outputs: one row per chart/table grain.
- Avoid massive detail queries in visible pages unless filtered or limited.
- Sort tables intentionally.

## When to ask the user

Ask a concise clarification when:

- the same field could mean multiple business concepts
- the dashboard goal requires unavailable data
- success criteria imply a metric not present in safe source SQL
- definitions affect decisions or user trust

If the user wants momentum, proceed with labeled assumptions and list what should be confirmed later.
