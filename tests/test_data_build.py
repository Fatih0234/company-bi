#!/usr/bin/env python3
"""Tests for cmux-evidence data build command."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CMUX_EVIDENCE = REPO_ROOT / "bin" / "cmux-evidence"


class DataBuildTestBase(unittest.TestCase):
    """Base class with shared setup for data build tests."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.workspace = Path(self.tmp.name) / "test-workspace"
        self.workspace.mkdir()

        # Create minimal Evidence workspace structure
        (self.workspace / ".cmux").mkdir()
        (self.workspace / ".cmux" / "evidence.json").write_text(json.dumps({
            "type": "evidence",
            "projectId": "test",
        }))
        (self.workspace / ".cmux" / "workspace.json").write_text(json.dumps({
            "kind": "lumen-analysis-workspace",
            "workspaceMode": "content-only",
            "workspaceRoot": str(self.workspace),
        }))

        # Create data directory with test data
        (self.workspace / "data").mkdir()
        (self.workspace / "data" / "orders.csv").write_text(
            "id,region,amount\n1,East,100\n2,West,200\n3,East,150\n4,West,250\n"
        )

        # Create pages directory
        (self.workspace / "pages").mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def run_build(self, *args, check=True):
        return subprocess.run(
            [sys.executable, str(CMUX_EVIDENCE), "data", "build", *args],
            cwd=self.workspace,
            check=check,
            text=True,
            capture_output=True,
        )

    def query_duckdb(self, db_path, sql):
        """Run a SQL query against a DuckDB file and return the first data value.
        
        DuckDB CLI returns formatted tables like:
        ┌──────────────┐
        │ count_star() │  <- header (column name)
        │    int64     │  <- type info
        ├──────────────┤  <- separator
        │            4 │  <- data row
        └──────────────┘
        
        This helper extracts the actual data value, skipping headers.
        """
        result = subprocess.run(
            ["duckdb", str(db_path), "-c", sql],
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = result.stdout.strip()
        
        # DuckDB output structure:
        #   ┌───┐     <- top border
        #   │ x │     <- column name (header)
        #   │ x │     <- type info
        #   ├───┤     <- separator
        #   │ x │     <- data row(s)
        #   └───┘     <- bottom border
        #
        # Strategy: skip everything until we see ├── (the separator),
        # then return the first value from the next │ row.
        
        seen_separator = False
        for line in output.split("\n"):
            stripped = line.strip()
            if stripped.startswith("├"):
                seen_separator = True
                continue
            if not seen_separator:
                continue
            if stripped.startswith("│") and stripped.endswith("│"):
                parts = [p.strip() for p in stripped.split("│") if p.strip()]
                if parts:
                    return parts[0]
        return output


class DataBuildTests(DataBuildTestBase):
    """Tests for the data build command."""

    def test_build_creates_staging_db_and_sources(self):
        """Build should create data.duckdb, connection.yaml, and source SQL files."""
        # Create build SQL
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "order_summary.sql").write_text(
            "CREATE TABLE order_summary AS SELECT region, COUNT(*) as cnt, SUM(amount) as total "
            "FROM read_csv_auto('data/orders.csv') GROUP BY 1;"
        )

        result = self.run_build()
        self.assertEqual(result.returncode, 0)
        self.assertIn("Built 1 tables", result.stdout)

        # Check staging DB exists
        staging_db = self.workspace / "sources" / "files" / "data.duckdb"
        self.assertTrue(staging_db.exists())

        # Check connection.yaml
        conn_yaml = self.workspace / "sources" / "files" / "connection.yaml"
        self.assertTrue(conn_yaml.exists())
        content = conn_yaml.read_text()
        self.assertIn('filename: "data.duckdb"', content)

        # Check source SQL
        source_sql = self.workspace / "sources" / "files" / "order_summary.sql"
        self.assertTrue(source_sql.exists())
        self.assertEqual(source_sql.read_text().strip(), "select * from order_summary")

    def test_build_creates_correct_tables(self):
        """Each build SQL file should create a corresponding table."""
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "by_region.sql").write_text(
            "CREATE TABLE by_region AS SELECT region, SUM(amount) as total "
            "FROM read_csv_auto('data/orders.csv') GROUP BY 1;"
        )
        (self.workspace / "build" / "by_id.sql").write_text(
            "CREATE TABLE by_id AS SELECT id, amount FROM read_csv_auto('data/orders.csv');"
        )

        result = self.run_build()
        self.assertEqual(result.returncode, 0)
        self.assertIn("Built 2 tables", result.stdout)

        # Verify tables exist in DuckDB
        staging_db = self.workspace / "sources" / "files" / "data.duckdb"
        tables = self.query_duckdb(staging_db, ".tables")
        self.assertIn("by_region", tables)
        self.assertIn("by_id", tables)

    def test_build_displays_row_counts(self):
        """Build output should show row counts for each table."""
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "summary.sql").write_text(
            "CREATE TABLE summary AS SELECT COUNT(*) as cnt FROM read_csv_auto('data/orders.csv');"
        )

        result = self.run_build()
        self.assertEqual(result.returncode, 0)
        self.assertIn("1 rows", result.stdout)

    def test_build_no_build_dir_prints_help(self):
        """When build/ doesn't exist, should print helpful message."""
        result = self.run_build(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("No build/ directory found", result.stdout)
        self.assertIn("build/*.sql", result.stdout)

    def test_build_empty_build_dir(self):
        """When build/ has no SQL files, should print error."""
        (self.workspace / "build").mkdir()

        result = self.run_build(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("No .sql files found", result.stdout)

    def test_build_sql_error_returns_nonzero(self):
        """When build SQL has errors, should report failure."""
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "bad.sql").write_text(
            "CREATE TABLE bad AS SELECT * FROM nonexistent_table;"
        )

        result = self.run_build(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("FAILED", result.stdout)

    def test_build_rewrites_raw_paths(self):
        """raw/ paths in build SQL should be rewritten to absolute paths."""
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "test.sql").write_text(
            "CREATE TABLE test AS SELECT * FROM read_csv_auto('data/orders.csv');"
        )

        result = self.run_build()
        self.assertEqual(result.returncode, 0)

        # Verify the table was created (means the path was resolved correctly)
        staging_db = self.workspace / "sources" / "files" / "data.duckdb"
        count = self.query_duckdb(staging_db, "SELECT count(*) FROM test")
        self.assertEqual(count, "4")

    def test_build_replaces_existing_staging_db(self):
        """Build should replace old staging DB with fresh one."""
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "v1.sql").write_text(
            "CREATE TABLE v1 AS SELECT 1 as version;"
        )

        # First build
        result1 = self.run_build()
        self.assertEqual(result1.returncode, 0)

        # Modify build SQL
        (self.workspace / "build" / "v1.sql").write_text(
            "CREATE TABLE v1 AS SELECT 2 as version;"
        )

        # Second build should replace
        result2 = self.run_build()
        self.assertEqual(result2.returncode, 0)

        staging_db = self.workspace / "sources" / "files" / "data.duckdb"
        version = self.query_duckdb(staging_db, "SELECT version FROM v1")
        self.assertEqual(version, "2")

    def test_build_removes_stale_source_sql(self):
        """Build should remove source SQL files for tables that no longer exist."""
        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "current.sql").write_text(
            "CREATE TABLE current AS SELECT 1 as val;"
        )

        # First build
        result1 = self.run_build()
        self.assertEqual(result1.returncode, 0)

        # Remove the build SQL and rebuild
        (self.workspace / "build" / "current.sql").unlink()
        (self.workspace / "build" / "new_table.sql").write_text(
            "CREATE TABLE new_table AS SELECT 2 as val;"
        )

        result2 = self.run_build()
        self.assertEqual(result2.returncode, 0)

        # Old source SQL should be gone
        old_sql = self.workspace / "sources" / "files" / "current.sql"
        self.assertFalse(old_sql.exists())

        # New source SQL should exist
        new_sql = self.workspace / "sources" / "files" / "new_table.sql"
        self.assertTrue(new_sql.exists())

    def test_build_with_parquet_files(self):
        """Build should work with parquet files in data/."""
        # Create a parquet file using DuckDB
        parquet_path = self.workspace / "data" / "events.parquet"
        subprocess.run(
            ["duckdb", "-c",
             f"COPY (SELECT 'event_' || i as name, i as value FROM generate_series(1, 100) t(i)) "
             f"TO '{parquet_path}' (FORMAT PARQUET);"],
            check=True,
            capture_output=True,
        )

        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "event_count.sql").write_text(
            "CREATE TABLE event_count AS SELECT COUNT(*) as cnt FROM read_parquet('data/events.parquet');"
        )

        result = self.run_build()
        self.assertEqual(result.returncode, 0)

        staging_db = self.workspace / "sources" / "files" / "data.duckdb"
        count = self.query_duckdb(staging_db, "SELECT cnt FROM event_count")
        self.assertEqual(count, "100")

    def test_build_preserves_raw_data(self):
        """Build should not modify files in data/."""
        original_content = (self.workspace / "data" / "orders.csv").read_text()

        (self.workspace / "build").mkdir()
        (self.workspace / "build" / "summary.sql").write_text(
            "CREATE TABLE summary AS SELECT COUNT(*) as cnt FROM read_csv_auto('data/orders.csv');"
        )

        self.run_build()

        # Original data should be untouched
        self.assertEqual((self.workspace / "data" / "orders.csv").read_text(), original_content)


if __name__ == "__main__":
    unittest.main()
