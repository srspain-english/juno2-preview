"""Exercise the real Vite startup guards without bundling or modifying dist."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import unittest


FRONTEND = Path(__file__).resolve().parents[1]


class StandaloneConfigurationTests(unittest.TestCase):
    def build_fingerprint(self):
        directory = FRONTEND / 'dist'
        self.assertTrue((directory / 'index.html').is_file(), 'Build the frontend before testing its configuration guards')
        return {str(path.relative_to(directory)): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in directory.rglob('*') if path.is_file()}

    def forbidden_configuration_fails_before_build(self, name):
        node = shutil.which('node')
        self.assertIsNotNone(node, 'Node is required; configuration checks are not skipped')
        vite = FRONTEND / 'node_modules/vite/bin/vite.js'
        self.assertTrue(vite.is_file(), 'Install reviewed frontend dependencies first')
        before = self.build_fingerprint()
        result = subprocess.run(
            [node, str(vite), 'build'], cwd=FRONTEND,
            env={'PATH': os.environ['PATH'], name: 'synthetic-forbidden-configuration'},
            capture_output=True, text=True, timeout=25,
        )
        output = result.stdout + result.stderr
        self.assertNotEqual(result.returncode, 0, output)
        self.assertIn('Remove provider, backend, and production configuration', output)
        self.assertNotIn('modules transformed', output)
        self.assertEqual(self.build_fingerprint(), before, 'A refused build must leave every existing artifact intact')

    def test_provider_credential_configuration_is_refused(self):
        self.forbidden_configuration_fails_before_build('ANTHROPIC_API_KEY')

    def test_juno_data_configuration_is_refused(self):
        self.forbidden_configuration_fails_before_build('JUNO_DATA_DIR')

    def test_render_deployment_configuration_is_refused(self):
        self.forbidden_configuration_fails_before_build('RENDER')

    def test_browser_exposed_api_configuration_is_refused(self):
        self.forbidden_configuration_fails_before_build('VITE_API_URL')

    def test_embedded_mode_cannot_be_built(self):
        before = self.build_fingerprint()
        result = subprocess.run(
            ['node', str(FRONTEND / 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'embedded-preview'],
            cwd=FRONTEND, env={'PATH': os.environ['PATH']}, capture_output=True, text=True, timeout=25,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Development-only CORS mode is not available', result.stdout + result.stderr)
        self.assertEqual(self.build_fingerprint(), before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
