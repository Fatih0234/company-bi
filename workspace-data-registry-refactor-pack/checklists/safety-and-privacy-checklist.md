# Safety and Privacy Checklist

- [ ] No `.env*` values read or printed.
- [ ] No connection secrets copied into generated files.
- [ ] Registry paths are workspace-relative.
- [ ] Generated SQL does not use unsafe parent paths.
- [ ] Raw `data/**` excluded from default publish.
- [ ] `.pi/duckdb/**` excluded from default publish.
- [ ] Data profiles do not store large raw samples by default.
- [ ] CLI refuses files outside workspace unless copied into `data/` by a future explicit add command.
