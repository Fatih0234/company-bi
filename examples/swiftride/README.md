# SwiftRide NYC Market Entry Playbook — Showcase Example

This is a complete, real-world analysis produced by LUMEN in a single
goal-driven session. It demonstrates the full pipeline: data ingestion,
insight exploration, polished report, and executive slide deck.

## What was built

A ride-hailing startup (SwiftRide) wanted a data-driven market entry
strategy for NYC. Using Jan–Mar 2024 TLC yellow and green taxi data
(9M+ trips), the agent answered 7 strategic questions and produced:

1. **7 analysis pages** (`q1.md`–`q7.md`) with SQL queries, charts, and findings
2. **Executive report** (`report.md`) — deployment playbook for 50 drivers
3. **Slide deck** (`slides/index.html`) — 17-slide self-contained HTML presentation
4. **Storyboard** (`slides/storyboard.md`) — slide-by-slide narrative with evidence traceability

## The 7 questions

| # | Question | Key Finding |
|---|----------|-------------|
| Q1 | Zone Strategy | JFK Airport is #1 target ($81 avg fare, no green competition) |
| Q2 | Time Strategy | Two shifts: morning rush (7–10 AM) + evening peak (4–8 PM) |
| Q3 | Competitive Positioning | Yellow owns Manhattan core; green clusters in gap zones |
| Q4 | Trip Profile | Sweet spot is 1–3 mile urban hops ($10–13/mi efficiency) |
| Q5 | The April Bet | March momentum +11.6% trips, +15.5% revenue — market expanding |
| Q6 | Airport vs Non-Airport | Airports are premium niche ($75 avg), not core strategy |
| Q7 | Weekend vs Weekday | Weekend peak shifts later, late night is distinct market |

## How it was produced

This analysis was generated in **one shot** using Pi's goal feature:

```
/create-goal "Complete all 7 SwiftRide market entry questions (Q1–Q7)
with data-backed findings in Evidence pages, synthesize into
pages/report.md, and generate a self-contained HTML slide deck..."
```

The agent ran through all 7 questions iteratively, built the report,
then created the slide deck — all without manual intervention between
steps. The goal intake document (`goal-intake.md`) captures the full
acceptance criteria that drove the session.

## Files

| File | What it is |
|------|------------|
| `report.md` | Executive report with deployment playbook, risk register, Plan B |
| `q1.md` | Zone Strategy analysis page (representative example) |
| `q7.md` | Weekend vs Weekday analysis page (representative example) |
| `slides/index.html` | Self-contained 17-slide HTML presentation deck |
| `slides/storyboard.md` | Slide-by-slide narrative outline with evidence traceability |
| `slides/story.json` | Structured story model for the deck |
| `goal-intake.md` | Goal definition and acceptance criteria |
| `images/` | Dashboard screenshots from the Evidence preview |

## Screenshots

### Q1: Zone Strategy — Green Taxi Gap Zones

![Zone Strategy](images/q1-zone-strategy.png)

### Q3: Competitive Positioning — Yellow Dominance

![Competitive Positioning](images/q3-competitive-positioning.png)

### Q7: Weekend vs Weekday Patterns

![Weekend vs Weekday](images/q7-weekend-vs-weekday.png)

## Data

This example uses NYC TLC trip data (Jan–Mar 2024):
- Yellow cab trips (~3M/month)
- Green cab trips (~56K/month)
- Taxi zone lookup (265 zones)

The data files are not included in this directory. To reproduce,
copy parquet files into a workspace `data/` directory and run
`cmux-evidence data refresh`.
