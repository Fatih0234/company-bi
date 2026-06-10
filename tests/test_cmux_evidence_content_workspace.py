import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CMUX_EVIDENCE = REPO_ROOT / "bin" / "cmux-evidence"


class CmuxEvidenceContentWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = (Path(self.tmp.name) / "project").resolve()
        self.root.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)

        self.workspace_dir = (Path(self.tmp.name) / "workspaces").resolve()
        self.runtime_dir = (Path(self.tmp.name) / "runtime").resolve()
        self.registry_path = (Path(self.tmp.name) / "registry.json").resolve()

        (self.root / ".cmux").mkdir()
        (self.root / "bin").mkdir()
        (self.root / "scripts").mkdir()
        (self.root / "sources" / "tlc").mkdir(parents=True)
        (self.root / ".pi" / "extensions").mkdir(parents=True)
        (self.root / ".evidence" / "template" / "static" / "data").mkdir(parents=True)
        (self.root / "node_modules").mkdir()

        (self.root / "package.json").write_text(
            json.dumps({"name": "test-project", "scripts": {"dev": "echo dev", "build": "echo build"}})
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

    def run_cmd(self, *args, cwd=None, check=True, input_text=None):
        return subprocess.run(
            [sys.executable, str(CMUX_EVIDENCE), *args],
            cwd=cwd or self.root,
            check=check,
            text=True,
            input=input_text,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def read_json(self, path):
        return json.loads(Path(path).read_text())

    def test_new_content_workspace_creates_clean_workspace_and_shadow_runtime(self):
        result = self.run_cmd("new", "--no-open", "Airport Demand")
        self.assertIn("Created analysis workspace: Airport Demand", result.stdout)
        self.assertIn("Start here:", result.stdout)
        self.assertIn("Explore in pages/draft.md", result.stdout)
        self.assertIn("Move validated findings to pages/report.md", result.stdout)
        self.assertIn("Publish shares pages/report.md and queries/** by default", result.stdout)
        self.assertIn("runtime files stay private", result.stdout)

        workspace = self.workspace_dir / "airport-demand"
        shadow = self.runtime_dir / "airport-demand"

        self.assertTrue((workspace / "pages" / "index.md").is_file())
        self.assertTrue((workspace / "pages" / "draft.md").is_file())
        self.assertTrue((workspace / "pages" / "report.md").is_file())
        self.assertTrue((workspace / "AGENTS.md").is_file())
        self.assertIn("## Start Here", (workspace / "pages" / "index.md").read_text())
        self.assertIn("## Files in this workspace", (workspace / "pages" / "index.md").read_text())
        self.assertIn("## Publish & privacy", (workspace / "pages" / "index.md").read_text())
        self.assertIn("default, publishing shares this page", (workspace / "pages" / "report.md").read_text())
        self.assertTrue((workspace / "queries").is_dir())
        self.assertTrue((workspace / "data").is_dir())
        self.assertTrue((workspace / "reports").is_dir())
        self.assertTrue((workspace / ".cmux" / "workspace.json").is_file())
        self.assertTrue((workspace / ".cmux" / "evidence.json").is_file())
        self.assertTrue((workspace / ".cmux" / "snapshots" / "initial" / "pages" / "report.md").is_file())

        # The user-facing workspace should not expose runtime implementation files.
        self.assertFalse((workspace / "package.json").exists())
        self.assertFalse((workspace / "bin").exists())
        self.assertFalse((workspace / "scripts").exists())
        self.assertFalse((workspace / "sources").exists())

        metadata = self.read_json(workspace / ".cmux" / "workspace.json")
        self.assertEqual(metadata["workspaceMode"], "content-only")
        self.assertEqual(metadata["kind"], "lumen-analysis-workspace")
        self.assertEqual(metadata["workspaceRoot"], str(workspace))
        self.assertEqual(metadata["shadowRuntimeRoot"], str(shadow))
        self.assertEqual(metadata["runtimeRoot"], str(self.root))
        self.assertEqual(metadata["pages"]["draft"], "pages/draft.md")

        workspace_config = self.read_json(workspace / ".cmux" / "evidence.json")
        self.assertEqual(workspace_config["registryPath"], str(self.registry_path))
        self.assertEqual(workspace_config["agentCommand"], str(self.root / "bin" / "pi-full"))

        self.assertTrue((shadow / "package.json").exists())
        self.assertTrue((shadow / "sources").exists())
        self.assertTrue((shadow / "pages").exists())
        self.assertTrue((shadow / "queries").exists())
        self.assertTrue((shadow / "reports").exists())
        self.assertTrue((shadow / "workspace-data").exists())
        self.assertTrue((shadow / ".evidence" / "template" / "static" / "data" / "manifest.json").exists())
        self.assertEqual((shadow / "pages" / "draft.md").read_text(), (workspace / "pages" / "draft.md").read_text())

        registry = self.read_json(self.registry_path)
        self.assertEqual(
            registry["projects"]["test-project"]["workspaces"]["airport-demand"]["workspaceRoot"],
            str(workspace),
        )

    def test_content_workspace_agents_md_contains_generic_agent_rules(self):
        self.run_cmd("new", "--no-open", "Agent Instructions")
        workspace = self.workspace_dir / "agent-instructions"
        agents_md = (workspace / "AGENTS.md").read_text()

        self.assertIn("LUMEN content-only Evidence analysis workspace", agents_md)
        self.assertIn("Runtime helper:", agents_md)
        self.assertIn(str(self.root / "bin" / "cmux-evidence"), agents_md)
        self.assertIn("`.cmux/workspace.json`", agents_md)
        self.assertIn("`pages/index.md`", agents_md)
        self.assertIn("`pages/draft.md`", agents_md)
        self.assertIn("`pages/report.md`", agents_md)
        self.assertIn("`pages/**`", agents_md)
        self.assertIn("`reports/**`", agents_md)
        self.assertIn("`data/**`", agents_md)
        self.assertIn("`package.json`", agents_md)
        self.assertIn("`bin/**`", agents_md)
        self.assertIn("`scripts/**`", agents_md)
        self.assertIn("files.orders", agents_md)
        self.assertIn("Do not use `read_csv_auto()`", agents_md)
        self.assertIn("validate` before declaring dashboard work complete", agents_md)
        self.assertIn("Publishing shares `pages/report.md` and `queries/**` by default", agents_md)
        self.assertNotIn("/Users/fatihkarahan/.opensrc", agents_md)

    def test_open_print_layout_uses_split_roots_for_content_workspace(self):
        self.run_cmd("new", "--no-open", "Split Root")
        layout = json.loads(self.run_cmd("open", "--print-layout", "split-root").stdout)

        agent = layout["children"][0]["pane"]["surfaces"][0]
        dev = layout["children"][1]["children"][1]["pane"]["surfaces"][0]

        self.assertEqual(agent["cwd"], str(self.workspace_dir / "split-root"))
        self.assertEqual(dev["cwd"], str(self.runtime_dir / "split-root"))
        self.assertEqual(agent["command"], str(self.root / "bin" / "pi-full"))
        self.assertEqual(dev["command"], "npm run dev -- --port 3900")

    def test_port_selection_uses_registry_not_only_workspace_files(self):
        self.registry_path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "projects": {
                        "test-project": {
                            "root": str(self.root),
                            "workspaces": {
                                "external-existing": {
                                    "slug": "external-existing",
                                    "port": 3900,
                                    "path": "/does/not/need/to/exist",
                                }
                            },
                        }
                    },
                },
                indent=2,
            )
            + "\n"
        )

        self.run_cmd("new", "--no-open", "Port Collision")
        metadata = self.read_json(self.workspace_dir / "port-collision" / ".cmux" / "workspace.json")
        self.assertEqual(metadata["port"], 3901)

    def test_open_repairs_missing_shadow_runtime_for_content_workspace(self):
        self.run_cmd("new", "--no-open", "Repair Runtime")
        shadow = self.runtime_dir / "repair-runtime"
        self.assertTrue(shadow.exists())
        subprocess.run(["rm", "-rf", str(shadow)], check=True)
        self.assertFalse(shadow.exists())

        layout = json.loads(self.run_cmd("open", "--print-layout", "repair-runtime").stdout)
        self.assertTrue((shadow / "package.json").exists())
        self.assertTrue((shadow / "pages").exists())
        self.assertTrue((shadow / "queries").exists())
        self.assertTrue((shadow / "reports").exists())
        self.assertTrue((shadow / "workspace-data").exists())
        dev = layout["children"][1]["children"][1]["pane"]["surfaces"][0]
        self.assertEqual(dev["cwd"], str(shadow))

    def test_validate_repairs_missing_shadow_runtime_without_traceback(self):
        self.run_cmd("new", "--no-open", "Validate Repair")
        workspace = self.workspace_dir / "validate-repair"
        shadow = self.runtime_dir / "validate-repair"
        subprocess.run(["rm", "-rf", str(shadow)], check=True)

        result = self.run_cmd("validate", cwd=workspace)
        self.assertIn("Running validation: npm run build", result.stdout)
        self.assertNotIn("Traceback", result.stderr)
        self.assertTrue((shadow / "package.json").exists())

    def test_content_workspace_context_uses_workspace_terms_and_valid_runtime_helper(self):
        self.run_cmd("new", "--no-open", "Agent Context")
        workspace = self.workspace_dir / "agent-context"

        context = self.run_cmd("context", "--print", cwd=workspace).stdout
        self.assertIn("Workspace mode: content-only", context)
        self.assertIn(f"Workspace root: {workspace}", context)
        self.assertIn(f"Workspace helper: {self.root / 'bin' / 'cmux-evidence'}", context)
        self.assertIn("Runtime source files are read-only references", context)
        self.assertIn("queries/", context)
        self.assertNotIn(f"Worktree: {workspace}", context)
        self.assertNotIn("./bin/cmux-evidence", context)

        saved_context = (workspace / ".cmux" / "pi-context.md").read_text()
        self.assertIn("Workspace mode: content-only", saved_context)
        self.assertIn(f"Workspace helper: {self.root / 'bin' / 'cmux-evidence'}", saved_context)
        self.assertIn("queries/", saved_context)

    def test_current_and_status_work_from_non_git_content_workspace(self):
        self.run_cmd("new", "--no-open", "No Git Status")
        workspace = self.workspace_dir / "no-git-status"

        current = self.run_cmd("current", cwd=workspace).stdout
        self.assertIn("Title: No Git Status", current)
        self.assertIn("Workspace mode: content-only", current)
        self.assertIn("Brief: pages/index.md", current)
        self.assertIn("Draft: pages/draft.md", current)
        self.assertIn("Report: pages/report.md", current)

        status = self.run_cmd("status", cwd=workspace).stdout
        self.assertIn("Workspace storage: local content workspace", status)
        self.assertIn("Git checkout: not used for this workspace mode", status)
        self.assertIn("Preview server:", status)
        self.assertNotIn("Git status:\nnot a Git checkout", status)

    def test_content_workspace_diff_uses_snapshot_not_git(self):
        self.run_cmd("new", "--no-open", "Content Diff")
        workspace = self.workspace_dir / "content-diff"
        (workspace / "pages" / "report.md").write_text("# Final Report\n\nPublished finding.\n")
        (workspace / "queries" / "answer.sql").write_text("select 42 as answer;\n")
        (workspace / ".pi" / "duckdb" / "exports").mkdir(parents=True)
        (workspace / ".pi" / "duckdb" / "exports" / "scratch.csv").write_text("not,publishable\n")

        diff = self.run_cmd("diff", cwd=workspace).stdout
        self.assertIn("Comparing publishable content against initial snapshot", diff)
        self.assertIn("M  pages/report.md", diff)
        self.assertIn("A  queries/answer.sql", diff)
        self.assertIn("Published finding", diff)
        self.assertNotIn("not a git repository", diff.lower())
        self.assertNotIn("scratch.csv", diff)

    def test_content_workspace_publish_materializes_report_and_queries_to_review_branch(self):
        self.run_cmd("new", "--no-open", "Publish Content")
        workspace = self.workspace_dir / "publish-content"
        (workspace / "pages" / "report.md").write_text("# Publish Me\n\nReady.\n")
        (workspace / "queries" / "metric.sql").write_text("select 1 as metric;\n")
        (workspace / "data" / "private.csv").write_text("secret-ish\n")

        result = self.run_cmd("publish", cwd=workspace, input_text="publish\n")
        self.assertIn("Route:  /reports/publish-content/", result.stdout)
        self.assertIn("local data files were not published", result.stdout.lower())
        publish_root = self.root / ".cmux" / "publish-worktrees" / "publish-content"
        self.assertTrue((publish_root / "pages" / "reports" / "publish-content" / "index.md").is_file())
        self.assertTrue((publish_root / "queries" / "publish-content" / "metric.sql").is_file())
        self.assertFalse((publish_root / "data" / "private.csv").exists())
        self.assertTrue((workspace / ".cmux" / "snapshots" / "last-published" / "pages" / "report.md").is_file())
        metadata = self.read_json(workspace / ".cmux" / "workspace.json")
        self.assertEqual(metadata["status"], "published")

    def test_list_uses_content_workspace_columns_not_empty_branch_column(self):
        self.run_cmd("new", "--no-open", "List Clarity")

        output = self.run_cmd("list").stdout
        self.assertIn("MODE", output)
        self.assertIn("TITLE", output)
        self.assertNotIn("BRANCH", output)
        self.assertIn("list-clarity", output)
        self.assertIn("content", output)
        self.assertIn("Open a workspace with: cmux-evidence open <slug>", output)

    def test_cmux_palette_uses_report_and_non_git_status_wording(self):
        palette = self.read_json(REPO_ROOT / ".cmux" / "cmux.json")
        self.assertEqual(palette["actions"]["evidence-publish"]["title"], "Evidence: Publish Report")
        self.assertEqual(palette["actions"]["evidence-status"]["subtitle"], "Show preview and workspace status")

    def test_git_worktree_layout_regression_still_uses_single_root_when_no_split_metadata(self):
        legacy = (Path(self.tmp.name) / "legacy-worktree").resolve()
        (legacy / ".cmux").mkdir(parents=True)
        legacy_config = {
            "type": "evidence",
            "projectId": "test-project",
            "port": 3999,
            "url": "http://localhost:3999/analysis/legacy",
            "agentCommand": "pi",
            "devCommand": "npm run dev -- --port 3999",
        }
        (legacy / ".cmux" / "evidence.json").write_text(json.dumps(legacy_config) + "\n")
        (legacy / ".cmux" / "workspace.json").write_text(
            json.dumps({"kind": "evidence-analysis", "slug": "legacy", "path": str(legacy)}) + "\n"
        )

        layout = json.loads(self.run_cmd("open", "--print-layout", str(legacy)).stdout)
        agent = layout["children"][0]["pane"]["surfaces"][0]
        dev = layout["children"][1]["children"][1]["pane"]["surfaces"][0]
        self.assertEqual(agent["cwd"], str(legacy))
        self.assertEqual(dev["cwd"], str(legacy))


if __name__ == "__main__":
    unittest.main()
