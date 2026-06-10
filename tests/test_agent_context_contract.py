import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class AgentContextContractTests(unittest.TestCase):
    def test_root_agents_md_has_required_context_sections(self):
        text = (REPO_ROOT / "AGENTS.md").read_text()

        for heading in [
            "## Project Model",
            "## Task Modes",
            "## Safety",
            "## Docs Routing",
            "## Validation",
            "## Post-Implementation Registration Rule",
        ]:
            self.assertIn(heading, text)

        for required_phrase in [
            "content-only workspaces",
            "Shadow runtime",
            "files.orders",
            "Do not read, quote, or expose `.env*`",
            ".agent/docs/evidence-oss/ROUTES.md",
            ".agent/docs/pi/ROUTES.md",
            ".agent/docs/cmux-com/ROUTES.md",
            "pi-pkg/package.json",
        ]:
            self.assertIn(required_phrase, text)

    def test_context_manifest_exists_and_routes_to_context_layers(self):
        text = (REPO_ROOT / "docs" / "agent-context-manifest.md").read_text()

        for required_phrase in [
            "Root agent instructions",
            "Workspace agent instructions",
            "Pi dynamic context",
            "Pi skills",
            "Docs routing",
            "Generated content workspaces include `AGENTS.md`",
        ]:
            self.assertIn(required_phrase, text)

    def test_docs_route_files_exist(self):
        for rel_path in [
            ".agent/docs/evidence-oss/ROUTES.md",
            ".agent/docs/evidence-oss/INDEX.md",
            ".agent/docs/pi/ROUTES.md",
            ".agent/docs/pi/INDEX.md",
            ".agent/docs/cmux-com/ROUTES.md",
            ".agent/docs/cmux-com/INDEX.md",
        ]:
            self.assertTrue((REPO_ROOT / rel_path).is_file(), rel_path)

    def test_pi_package_registered_paths_exist(self):
        package = json.loads((REPO_ROOT / "pi-pkg" / "package.json").read_text())
        pi = package["pi"]

        for section in ["extensions", "skills", "prompts", "themes"]:
            self.assertIn(section, pi)
            self.assertIsInstance(pi[section], list)
            self.assertGreater(len(pi[section]), 0)
            for registered in pi[section]:
                path = REPO_ROOT / "pi-pkg" / registered
                self.assertTrue(path.exists(), f"{section} path is registered but missing: {registered}")

    def test_critical_pi_assets_remain_registered(self):
        package = json.loads((REPO_ROOT / "pi-pkg" / "package.json").read_text())
        pi = package["pi"]

        critical = {
            "extensions": [
                "./extensions/evidence-context.ts",
                "./extensions/analysis-intention",
                "./extensions/duckdb-bi",
                "./extensions/evidence-quality-guard",
                "./extensions/evidence-health-check.ts",
            ],
            "skills": [
                "./skills/evidence-dashboard",
                "./skills/evidence-dashboard-review",
                "./skills/evidence-bi-thinking",
                "./skills/data-discovery",
                "./skills/cmux-browser",
            ],
            "prompts": [
                "./prompts/evidence-dashboard.md",
            ],
            "themes": [
                "./themes/lumen-bi-midnight.json",
            ],
        }

        for section, paths in critical.items():
            registered = set(pi[section])
            for path in paths:
                self.assertIn(path, registered, f"critical {section} asset is not registered: {path}")

    def test_pi_full_repairs_broad_workspace_pi_extension_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            workspace = Path(tmp) / "workspace"
            fake_bin = Path(tmp) / "bin"
            workspace.mkdir()
            fake_bin.mkdir()
            (workspace / ".cmux").mkdir()
            (workspace / ".cmux" / "workspace.json").write_text("{}\n")
            (workspace / ".pi").mkdir()
            (workspace / ".pi" / "extensions").symlink_to(REPO_ROOT / "pi-pkg" / "extensions", target_is_directory=True)

            fake_pi = fake_bin / "pi"
            fake_pi.write_text("#!/usr/bin/env bash\nprintf 'fake pi %s\\n' \"$*\"\n")
            fake_pi.chmod(0o755)

            env = os.environ.copy()
            env["PATH"] = f"{fake_bin}{os.pathsep}{env.get('PATH', '')}"
            result = subprocess.run(
                [str(REPO_ROOT / "bin" / "pi-full"), "--version"],
                cwd=workspace,
                env=env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )

            self.assertIn("fake pi", result.stdout)
            extensions = workspace / ".pi" / "extensions"
            self.assertTrue(extensions.is_dir())
            self.assertFalse(extensions.is_symlink())
            self.assertTrue((extensions / "evidence-context.ts").is_symlink())
            self.assertTrue((extensions / "evidence-health-check.ts").is_symlink())
            self.assertFalse((extensions / "evidence-health-check.test.ts").exists())


if __name__ == "__main__":
    unittest.main()
