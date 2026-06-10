# Antigravity Web Research Brief

## Task Pi is trying to solve

We are building a BI dashboard workspace system (Evidence-based) that needs a fast, reliable data ingestion pipeline. When users upload data files (parquet, CSV) to a workspace `data/` directory, the system must register them and make them available for SQL queries in dashboard pages.

## Current blocker or uncertainty

The data ingestion pipeline takes 10-20 minutes to complete for a typical dataset of 7 files (6 parquet files totaling ~260MB, 1 CSV file totaling ~12KB). This blocks the agent and the user from proceeding with dashboard creation.

## Technical details of the current implementation

### Architecture
- **Workspace type**: Content-only workspace (user edits in one directory, Evidence app runs in a separate "shadow runtime" directory)
- **Shadow runtime**: A full Evidence.js application with npm dependencies, used only for development server and source extraction
- **Data files**: Stored in `data/` directory of the content workspace
- **Source SQL files**: Generated in shadow runtime at `sources/files/*.sql`, each containing `SELECT * FROM read_parquet('workspace-data/filename.parquet')`
- **Extracted tables**: Stored in `.evidence/meta/files/` directory of the shadow runtime

### Current pipeline steps
1. **Registry refresh** (< 1 second): Python script scans `data/` directory, creates `data-registry.json` with file metadata, generates source SQL files in shadow runtime
2. **npm sources extraction** (5-10 minutes): `npm run sources -- --sources files` runs Evidence's source extraction, which reads each file via DuckDB and writes extracted data to `.evidence/meta/files/`

### Performance characteristics
- **Registry refresh**: < 1 second (Python file operations)
- **npm sources extraction**: 5-10 minutes for 7 files (~260MB total)
  - Green taxi files (1.3MB each, ~56K rows): ~5 seconds each
  - Taxi zone lookup (12KB, 265 rows): < 1 second
  - Yellow taxi files (50-60MB each, 3M rows): 2-3 minutes each
- **Total pipeline time**: 10-20 minutes (dominated by yellow taxi extraction)

### File specifications
| File | Format | Size | Rows | Extraction Time |
|------|--------|------|------|-----------------|
| green_tripdata_2024-01.parquet | Parquet | 1.3 MB | 56,551 | ~5s |
| green_tripdata_2024-02.parquet | Parquet | 1.2 MB | 53,577 | ~5s |
| green_tripdata_2024-03.parquet | Parquet | 1.3 MB | 57,457 | ~5s |
| taxi_zone_lookup.csv | CSV | 12 KB | 265 | <1s |
| yellow_tripdata_2024-01.parquet | Parquet | 50 MB | 2,964,624 | ~2-3 min |
| yellow_tripdata_2024-02.parquet | Parquet | 50 MB | 3,007,526 | ~2-3 min |
| yellow_tripdata_2024-03.parquet | Parquet | 60 MB | 3,582,628 | ~2-3 min |

### npm sources behavior
- Processes files sequentially (not in parallel)
- Each file: reads via DuckDB, writes extracted data to `.evidence/meta/files/<alias>/`
- Large files produce warnings: "Estimated output size is 1,113.951mb uncompressed"
- No progress indicator beyond per-file completion messages
- Process can be killed by timeout, leaving incomplete extractions

### Current timeout workarounds tried
1. **Subprocess timeout (60s)**: Command returns success but extraction may be incomplete
2. **Detached background process (nohup)**: Process continues after parent shell exits, but agent doesn't know when it's done
3. **Manual npm sources run**: Agent runs `npm run sources` directly, waits 3-5 minutes, then checks if tables exist

### Observed failure modes
1. **Incomplete extraction**: npm sources process killed before completing all files, leaving some tables missing
2. **Agent confusion**: Command returns "success" but tables aren't available, agent builds dashboard with missing data
3. **Dashboard query failures**: SQL queries reference tables that don't exist yet
4. **Wasted time**: Agent spends 10-20 minutes waiting instead of planning or building

## What Pi needs from Antigravity

Research how other data pipeline systems, BI tools, or similar architectures handle large file ingestion efficiently. Specifically:

1. What are common approaches to parallel file processing in data pipelines?
2. How do other Evidence.js or similar BI tools handle source extraction?
3. Are there ways to optimize DuckDB parquet reading for large files?
4. What are best practices for background data ingestion with progress tracking?
5. Are there alternative architectures that avoid the sequential extraction bottleneck?

## Web research requirement
- Use external web search, documentation lookup, source repositories, changelogs, release notes, GitHub issues, standards.
- Do not answer only from model memory.
- Include URLs and one-line relevance notes for all important sources.
- If web search is unavailable or fails, say so clearly and do not pretend the answer is source-backed.

## Local context
- Runtime: macOS (Apple Silicon), Node.js v22.22.1, Python 3.14
- Evidence.js version: current (installed via npm)
- DuckDB: Used by Evidence for source extraction
- Files: Parquet format (via DuckDB read_parquet), CSV format (via DuckDB read_csv_auto)
- Shadow runtime: Full npm project with Evidence dependencies

## Things already tried
1. Running `cmux-evidence data refresh` synchronously: hangs for 10-20 minutes
2. Adding subprocess timeout (60s): command returns success but extraction incomplete
3. Running npm sources as detached background process: process continues but agent doesn't know when it's done
4. Running npm sources manually and waiting: works but takes 3-5 minutes, agent must poll

## Constraints and safety boundaries
- Pi is the delegator. Antigravity should perform web research and write a report only.
- Do not edit the project repository.
- Do not inspect secrets, credentials, tokens, .env files, SSH keys, private keys, or production config.
- The solution must work within the existing Evidence.js architecture (cannot replace Evidence's source extraction system).
- The solution must handle both parquet and CSV files.
- The solution must be reliable (no incomplete extractions).

## Desired output
Write a concise Markdown report that helps Pi choose the next implementation step. Focus on:
1. What are the proven approaches to this class of problem?
2. What would need to change in the current architecture?
3. What is the recommended next step?

## Source preferences
Prefer official documentation, source repositories, changelogs, release notes, GitHub issues, standards, and reputable technical sources. Focus on:
- Evidence.js documentation and source code
- DuckDB documentation (parquet reading, performance)
- Data pipeline best practices
- Node.js subprocess management
- Parallel processing patterns
