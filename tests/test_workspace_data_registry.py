#!/usr/bin/env python3
"""Tests for workspace data registry: scan, refresh, source generation, CLI commands."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CMUX_EVIDENCE = REPO_ROOT / "bin" / "cmux-evidence"
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures" / "workspace-data"

# Import the registry module directly
sys.path.insert(0, str(REPO_ROOT / "scripts"))
import workspace_data_registry as wdr


class WorkspaceDataRegistryUnitTests(unittest.TestCase):
    """Pure unit tests for registry helper functions (no filesystem)."""

    def test_slugify_simple(self):
        self.assertEqual(wdr.slugify_table_alias("orders.csv"), "orders")

    def test_slugify_with_spaces(self):
        self.assertEqual(wdr.slugify_table_alias("Monthly Sales 2026.csv"), "monthly_sales_2026")

    def test_slugify_starts_with_digit(self):
        self.assertEqual(wdr.slugify_table_alias("123_data.csv"), "table_123_data")

    def test_slugify_empty_after_clean(self):
        self.assertEqual(wdr.slugify_table_alias("---.csv"), "data_file")

    def test_slugify_keeps_underscores(self):
        self.assertEqual(wdr.slugify_table_alias("my_table.csv"), "my_table")

    def test_unique_alias_no_collision(self):
        self.assertEqual(wdr.unique_alias("orders", set()), "orders")

    def test_unique_alias_with_collision(self):
        self.assertEqual(wdr.unique_alias("orders", {"orders"}), "orders_2")

    def test_unique_alias_multiple_collisions(self):
        self.assertEqual(wdr.unique_alias("orders", {"orders", "orders_2"}), "orders_3")


class WorkspaceDataRegistryScanTests(unittest.TestCase):
    """Tests for file scanning and registry refresh with real filesystem."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "workspace"
        self.root.mkdir()
        # Create .cmux dir
        (self.root / ".cmux").mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def _make_data_dir(self, files: dict[str, str] | None = None) -> Path:
        data_dir = self.root / "data"
        data_dir.mkdir(exist_ok=True)
        if files:
            for name, content in files.items():
                (data_dir / name).write_text(content)
        return data_dir

    def test_scan_empty_data_dir(self):
        self._make_data_dir()
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(result, [])

    def test_scan_no_data_dir(self):
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(result, [])

    def test_scan_csv_files(self):
        self._make_data_dir({
            "orders.csv": "id,amount\n1,100\n",
            "customers.csv": "id,name\n1,Alice\n",
        })
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(len(result), 2)
        paths = {f["path"] for f in result}
        self.assertIn("data/orders.csv", paths)
        self.assertIn("data/customers.csv", paths)

    def test_scan_ignores_hidden_files(self):
        self._make_data_dir({
            "orders.csv": "id,amount\n1,100\n",
            ".hidden.csv": "id,name\n",
        })
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["path"], "data/orders.csv")

    def test_scan_ignores_unsupported_formats(self):
        self._make_data_dir({
            "orders.csv": "id,amount\n1,100\n",
            "notes.txt": "some notes\n",
            "image.png": "binary",
        })
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["format"], "csv")

    def test_scan_recognizes_parquet(self):
        self._make_data_dir({"events.parquet": "binary"})
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["format"], "parquet")

    def test_scan_recognizes_jsonl(self):
        self._make_data_dir({"logs.jsonl": '{"a":1}\n'})
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["format"], "jsonl")

    def test_scan_nested_files(self):
        data_dir = self._make_data_dir()
        nested = data_dir / "archive"
        nested.mkdir()
        (nested / "old_orders.csv").write_text("id\n1\n")
        result = wdr.scan_workspace_data_files(self.root)
        self.assertEqual(len(result), 1)
        self.assertIn("archive/old_orders.csv", result[0]["path"])

    def test_scan_depth_limit(self):
        data_dir = self._make_data_dir()
        deep = data_dir
        for i in range(7):
            deep = deep / f"level_{i}"
            deep.mkdir()
        (deep / "deep.csv").write_text("id\n1\n")
        result = wdr.scan_workspace_data_files(self.root)
        # Should NOT find files deeper than MAX_SCAN_DEPTH (5)
        self.assertEqual(len(result), 0)


class WorkspaceDataRegistryRefreshTests(unittest.TestCase):
    """Tests for registry refresh behavior."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "workspace"
        self.root.mkdir()
        (self.root / ".cmux").mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def _make_data(self, files: dict[str, str]) -> None:
        data_dir = self.root / "data"
        data_dir.mkdir(exist_ok=True)
        for name, content in files.items():
            (data_dir / name).write_text(content)

    def test_refresh_empty_creates_registry(self):
        self._make_data({})
        registry = wdr.refresh_workspace_data_registry(self.root)
        self.assertEqual(registry["version"], 1)
        self.assertEqual(registry["sourceName"], "files")
        self.assertEqual(registry["tables"], [])

    def test_refresh_creates_registry_file(self):
        self._make_data({})
        wdr.refresh_workspace_data_registry(self.root)
        registry_path = wdr.data_registry_path(self.root)
        self.assertTrue(registry_path.exists())
        data = json.loads(registry_path.read_text())
        self.assertEqual(data["version"], 1)

    def test_refresh_csv_registration(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        tables = registry["tables"]
        self.assertEqual(len(tables), 1)
        t = tables[0]
        self.assertEqual(t["alias"], "orders")
        self.assertEqual(t["qualifiedName"], "files.orders")
        self.assertEqual(t["path"], "data/orders.csv")
        self.assertEqual(t["format"], "csv")
        self.assertEqual(t["status"], "ready")

    def test_refresh_preserves_aliases(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        first_alias = registry["tables"][0]["alias"]

        # Add another file, refresh again
        self._make_data({
            "orders.csv": "id,amount\n1,100\n",
            "customers.csv": "id,name\n1,Alice\n",
        })
        registry = wdr.refresh_workspace_data_registry(self.root)
        orders_table = [t for t in registry["tables"] if t["path"] == "data/orders.csv"][0]
        self.assertEqual(orders_table["alias"], first_alias)

    def test_refresh_duplicate_aliases(self):
        data_dir = self.root / "data"
        data_dir.mkdir()
        archive = data_dir / "archive"
        archive.mkdir()
        (data_dir / "orders.csv").write_text("id\n1\n")
        (archive / "orders.csv").write_text("id\n2\n")

        registry = wdr.refresh_workspace_data_registry(self.root)
        aliases = [t["alias"] for t in registry["tables"]]
        self.assertIn("orders", aliases)
        self.assertIn("orders_2", aliases)

    def test_refresh_marks_missing_files(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        self.assertEqual(len(registry["tables"]), 1)
        self.assertEqual(registry["tables"][0]["status"], "ready")

        # Delete the file
        (self.root / "data" / "orders.csv").unlink()
        registry = wdr.refresh_workspace_data_registry(self.root)
        self.assertEqual(len(registry["tables"]), 1)
        self.assertEqual(registry["tables"][0]["status"], "missing")

    def test_refresh_with_fixtures(self):
        # Use the actual test fixtures
        data_dir = self.root / "data"
        data_dir.mkdir()
        shutil.copy(FIXTURES_DIR / "orders.csv", data_dir / "orders.csv")
        shutil.copy(FIXTURES_DIR / "customers.csv", data_dir / "customers.csv")

        registry = wdr.refresh_workspace_data_registry(self.root)
        self.assertEqual(len(registry["tables"]), 2)
        aliases = {t["alias"] for t in registry["tables"]}
        self.assertEqual(aliases, {"orders", "customers"})
        for t in registry["tables"]:
            self.assertEqual(t["status"], "ready")
            self.assertEqual(t["qualifiedName"], f"files.{t['alias']}")


class WorkspaceDataRegistrySourceGenerationTests(unittest.TestCase):
    """Tests for shadow runtime source SQL generation."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "workspace"
        self.shadow = Path(self.tmp.name) / "shadow"
        self.root.mkdir()
        self.shadow.mkdir()
        (self.root / ".cmux").mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def _make_data(self, files: dict[str, str]) -> None:
        data_dir = self.root / "data"
        data_dir.mkdir(exist_ok=True)
        for name, content in files.items():
            (data_dir / name).write_text(content)

    def test_generates_connection_yaml(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        conn = self.shadow / "sources" / "files" / "connection.yaml"
        self.assertTrue(conn.exists())
        content = conn.read_text()
        self.assertIn("name: files", content)
        self.assertIn("type: duckdb", content)
        self.assertIn("Generated by cmux-evidence data refresh", content)

    def test_generates_sql_for_csv(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        sql_file = self.shadow / "sources" / "files" / "orders.sql"
        self.assertTrue(sql_file.exists())
        sql = sql_file.read_text()
        self.assertIn("read_csv_auto('workspace-data/orders.csv')", sql)
        self.assertIn("Generated by cmux-evidence data refresh", sql)
        self.assertIn("-- Source file: data/orders.csv", sql)

    def test_generates_sql_for_parquet(self):
        self._make_data({"events.parquet": "binary"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        sql = (self.shadow / "sources" / "files" / "events.sql").read_text()
        self.assertIn("read_parquet('workspace-data/events.parquet')", sql)

    def test_generates_sql_for_jsonl(self):
        self._make_data({"logs.jsonl": '{"a":1}\n'})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        sql = (self.shadow / "sources" / "files" / "logs.sql").read_text()
        self.assertIn("read_json_auto('workspace-data/logs.jsonl')", sql)

    def test_generates_sql_for_tsv(self):
        self._make_data({"data.tsv": "id\tname\n1\tAlice\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        sql = (self.shadow / "sources" / "files" / "data.sql").read_text()
        self.assertIn("read_csv_auto('workspace-data/data.tsv', delim='\\t')", sql)

    def test_removes_stale_sql_files(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)
        self.assertTrue((self.shadow / "sources" / "files" / "orders.sql").exists())

        # Remove file, refresh, regenerate
        (self.root / "data" / "orders.csv").unlink()
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)
        self.assertFalse((self.shadow / "sources" / "files" / "orders.sql").exists())

    def test_generated_files_not_in_content_workspace(self):
        self._make_data({"orders.csv": "id,amount\n1,100\n"})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        # Should NOT be in the content workspace
        content_sources = self.root / "sources" / "files"
        self.assertFalse(content_sources.exists())

    def test_empty_registry_generates_only_connection(self):
        self._make_data({})
        registry = wdr.refresh_workspace_data_registry(self.root)
        wdr.generate_workspace_file_sources(self.root, self.shadow, registry)

        files_dir = self.shadow / "sources" / "files"
        self.assertTrue(files_dir.exists())
        self.assertTrue((files_dir / "connection.yaml").exists())
        sql_files = list(files_dir.glob("*.sql"))
        self.assertEqual(sql_files, [])


class WorkspaceDataRegistryCLITests(unittest.TestCase):
    """Integration tests for CLI data commands."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = (Path(self.tmp.name) / "project").resolve()
        self.root.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)

        self.workspace_dir = (Path(self.tmp.name) / "workspaces").resolve()
        self.runtime_dir = (Path(self.tmp.name) / "runtime").resolve()
        self.registry_path = (Path(self.tmp.name) / "registry.json").resolve()

        # Set up minimal project structure
        (self.root / ".cmux").mkdir()
        (self.root / "bin").mkdir()
        (self.root / "scripts").mkdir()
        (self.root / "sources" / "tlc").mkdir(parents=True)
        (self.root / ".pi" / "extensions").mkdir(parents=True)
        (self.root / ".evidence" / "template" / "static" / "data").mkdir(parents=True)
        (self.root / "node_modules").mkdir()

        (self.root / "package.json").write_text(
            json.dumps({"name": "test-project", "scripts": {"dev": "echo dev", "build": "echo build", "sources": "echo sources"}})
        )
        (self.root / "package-lock.json").write_text("{}\n")
        (self.root / "evidence.config.yaml").write_text(
            'plugins:\n  datasources:\n    "@evidence-dev/duckdb": {}\n'
        )
        (self.root / "sources" / "tlc" / "trips.sql").write_text("select 1 as trip_count\n")
        (self.root / ".evidence" / "template" / "static" / "data" / "manifest.json").write_text('{"cached": true}\n')
        (self.root / "bin" / "lumen-pi").write_text("#!/usr/bin/env bash\necho pi\n")
        (self.root / "bin" / "pi-full").write_text("#!/usr/bin/env bash\necho pi\n")
        (self.root / "scripts" / "run_evidence_dev.sh").write_text("#!/usr/bin/env bash\necho dev\n")

        config = {
            "type": "evidence",
            "projectId": "test-project",
            "workspaceMode": "content-only",
            "port": 3000,
            "agentCommand": "./bin/lumen-pi",
            "devCommand": "npm run dev",
            "url": "http://localhost:3000",
            "workspaceDir": str(self.workspace_dir),
            "runtimeDir": str(self.runtime_dir),
            "registryPath": str(self.registry_path),
            "analysisBasePort": 3900,
            "validateCommand": "npm run build",
            "allowedAgentPaths": ["pages/**", "reports/**", "data/**"],
            "blockedAgentPaths": ["package.json", "bin/**", "scripts/**"],
        }
        (self.root / ".cmux" / "evidence.json").write_text(json.dumps(config, indent=2) + "\n")
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=self.root, check=True)
        subprocess.run(["git", "checkout", "-B", "main"], cwd=self.root, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        subprocess.run(["git", "add", "-A"], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-m", "Initial test project"], cwd=self.root, check=True, stdout=subprocess.PIPE)

    def tearDown(self):
        self.tmp.cleanup()

    def run_cmd(self, *args, cwd=None, check=True):
        return subprocess.run(
            [sys.executable, str(CMUX_EVIDENCE), *args],
            cwd=cwd or self.root,
            check=check,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def _create_workspace_with_data(self) -> Path:
        """Create a content workspace and put data files in it."""
        result = self.run_cmd("new", "--no-open", "Data Registry Test")
        self.assertEqual(result.returncode, 0)

        # Find the workspace directory
        workspace = None
        for d in self.workspace_dir.iterdir():
            if d.is_dir() and d.name == "data-registry-test":
                workspace = d
                break
        self.assertIsNotNone(workspace, f"Workspace not found in {self.workspace_dir}")

        # Add data files
        data_dir = workspace / "data"
        data_dir.mkdir(exist_ok=True)
        shutil.copy(FIXTURES_DIR / "orders.csv", data_dir / "orders.csv")
        shutil.copy(FIXTURES_DIR / "customers.csv", data_dir / "customers.csv")

        return workspace

    def test_data_list_no_registry(self):
        result = self.run_cmd("data", "list", cwd=self.root)
        self.assertEqual(result.returncode, 0)
        self.assertIn("No workspace data", result.stdout)

    def test_data_refresh_empty_workspace(self):
        workspace = self._create_workspace_with_data()
        # Clear the data
        for f in (workspace / "data").iterdir():
            f.unlink()

        result = self.run_cmd("data", "refresh", cwd=workspace)
        self.assertEqual(result.returncode, 0)
        self.assertIn("No workspace data files found", result.stdout)

    def test_data_refresh_creates_registry(self):
        workspace = self._create_workspace_with_data()
        result = self.run_cmd("data", "refresh", cwd=workspace)
        self.assertEqual(result.returncode, 0)

        registry_path = workspace / ".cmux" / "data-registry.json"
        self.assertTrue(registry_path.exists())

        registry = json.loads(registry_path.read_text())
        self.assertEqual(len(registry["tables"]), 2)
        aliases = {t["alias"] for t in registry["tables"]}
        self.assertEqual(aliases, {"orders", "customers"})

    def test_data_refresh_generates_source_sql(self):
        workspace = self._create_workspace_with_data()
        result = self.run_cmd("data", "refresh", cwd=workspace)
        self.assertEqual(result.returncode, 0)

        # Check shadow runtime has generated source files
        shadow_runtime = None
        workspace_json = json.loads((workspace / ".cmux" / "workspace.json").read_text())
        shadow_value = workspace_json.get("shadowRuntimeRoot")
        if shadow_value:
            shadow_runtime = Path(shadow_value)

        if shadow_runtime and shadow_runtime.exists():
            files_dir = shadow_runtime / "sources" / "files"
            if files_dir.exists():
                self.assertTrue((files_dir / "connection.yaml").exists())
                self.assertTrue((files_dir / "orders.sql").exists())
                self.assertTrue((files_dir / "customers.sql").exists())

    def test_data_list_after_refresh(self):
        workspace = self._create_workspace_with_data()
        self.run_cmd("data", "refresh", cwd=workspace)

        result = self.run_cmd("data", "list", cwd=workspace)
        self.assertEqual(result.returncode, 0)
        self.assertIn("files.orders", result.stdout)
        self.assertIn("files.customers", result.stdout)

    def test_data_refresh_stable_aliases(self):
        workspace = self._create_workspace_with_data()
        self.run_cmd("data", "refresh", cwd=workspace)
        registry1 = json.loads((workspace / ".cmux" / "data-registry.json").read_text())
        aliases1 = {t["alias"]: t["path"] for t in registry1["tables"]}

        # Add another file
        shutil.copy(FIXTURES_DIR / "orders.csv", workspace / "data" / "more_orders.csv")
        self.run_cmd("data", "refresh", cwd=workspace)
        registry2 = json.loads((workspace / ".cmux" / "data-registry.json").read_text())
        aliases2 = {t["alias"]: t["path"] for t in registry2["tables"]}

        # Original aliases should be preserved
        for alias, path in aliases1.items():
            self.assertIn(alias, aliases2)
            self.assertEqual(aliases2[alias], path)

    def test_data_help(self):
        result = self.run_cmd("data", check=False)
        self.assertIn("Usage: cmux-evidence data", result.stdout)


if __name__ == "__main__":
    unittest.main()
