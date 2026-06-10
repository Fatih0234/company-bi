# Evidence Data Source Notes

Use current Evidence docs as source of truth.

Relevant docs:

- `https://docs.evidence.dev/core-concepts/data-sources/`
- `https://docs.evidence.dev/core-concepts/queries/`
- `https://docs.evidence.dev/core-concepts/data-sources/csv/`

Important facts:

- Evidence extracts data sources into Parquet and then queries them with SQL.
- `npm run sources` extracts configured sources.
- SQL source files under `/sources/[source_name]/` create tables queryable as `[source_name].[query_file_name]`.
- Markdown SQL code fences are page queries.
- Page query results are referenced in components as `data={query_name}`.
- CSV files can be used as an Evidence data source.

Design implication:

The refactor should generate Evidence-compatible source tables like `files.orders` and make dashboard pages query those names. It should not make dashboard page SQL depend on raw file paths.
