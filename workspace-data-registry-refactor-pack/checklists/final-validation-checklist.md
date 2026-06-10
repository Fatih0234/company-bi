# Final Validation Checklist

Run before calling the refactor complete:

- [ ] `python -m unittest tests/test_cmux_evidence_content_workspace.py`
- [ ] `python -m unittest tests/test_workspace_data_registry.py`
- [ ] Extension tests if `duckdb-bi` changed.
- [ ] `npm run build` if dependencies are available.
- [ ] Create a fresh workspace.
- [ ] Refresh with no data.
- [ ] Refresh with CSV data.
- [ ] Confirm `files.<alias>` page SQL works.
- [ ] Confirm publish excludes `data/**`.
- [ ] Search for stale default TLC/MinIO references.
