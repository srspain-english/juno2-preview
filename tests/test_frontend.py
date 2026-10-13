"""Standalone frontend acceptance tests; no Juno server, identity, audio, or APIs.

The production build is exercised in Chromium using a disposable strict static
server under its Pages subpath. Missing tools fail rather than
silently skipping the browser checks.
"""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


FRONTEND = Path(__file__).resolve().parents[1]
CHROMIUM = Path('/usr/bin/chromium')

# Instrument access, including APIs that should never be used by this build.
# Throwing is intentional: accidental identity persistence or microphone use
# must fail acceptance checks rather than quietly falling back to demo state.
ISOLATION_SCRIPT = """
window.__frontendAudit = {storage: [], microphone: [], synthesis: [], sockets: []};
for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
  Storage.prototype[method] = function() {
    window.__frontendAudit.storage.push(method);
    throw new Error('Standalone frontend must not access browser storage');
  };
}
Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {
  getUserMedia: async () => {
    window.__frontendAudit.microphone.push('getUserMedia');
    throw new Error('Standalone frontend must not capture microphone audio');
  }
}});
for (const name of ['SpeechRecognition', 'webkitSpeechRecognition', 'MediaRecorder']) {
  Object.defineProperty(window, name, {configurable: true, value: function() {
    window.__frontendAudit.microphone.push(name);
    throw new Error('Standalone frontend must not start voice features');
  }});
}
if (window.speechSynthesis) {
  window.speechSynthesis.speak = () => {
    window.__frontendAudit.synthesis.push('speak');
    throw new Error('Standalone frontend must not send text to voice services');
  };
}
for (const name of ['WebSocket', 'EventSource']) {
  Object.defineProperty(window, name, {configurable: true, value: function(url) {
    window.__frontendAudit.sockets.push(String(url));
    throw new Error('Standalone frontend must not open persistent connections');
  }});
}
"""


class StandaloneFrontendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which('npm') or not CHROMIUM.is_file():
            raise RuntimeError('npm and system Chromium are required; browser tests are not skipped')
        if not (FRONTEND / 'dist/index.html').is_file():
            raise RuntimeError('Run npm ci and npm run build before browser acceptance tests')
        cls.logs = tempfile.TemporaryFile(mode='w+')
        cls.addClassCleanup(cls.logs.close)
        cls.static_root = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.static_root.cleanup)
        shutil.copytree(FRONTEND / 'dist', Path(cls.static_root.name) / 'juno2-preview')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        cls.url = f'http://127.0.0.1:{port}/juno2-preview/'
        # Strict static hosting, no Vite/Python-backend SPA fallback. Hash route
        # refreshes must work with the same constraints as GitHub Pages.
        cls.server = subprocess.Popen(
            [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', cls.static_root.name],
            cwd=FRONTEND, env={'PATH': os.environ['PATH']},
            stdout=cls.logs, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        cls.addClassCleanup(cls.close_server)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if cls.server.poll() is not None:
                cls.logs.seek(0)
                raise RuntimeError('Preview failed to start:\n' + cls.logs.read())
            try:
                with urllib.request.urlopen(cls.url, timeout=.5) as response:
                    if response.status == 200:
                        break
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                time.sleep(.1)
        else:
            raise RuntimeError('Standalone preview did not become ready')
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            executable_path=str(CHROMIUM), headless=True,
        )
        cls.addClassCleanup(cls.browser.close)

    @classmethod
    def close_server(cls):
        if cls.server.poll() is None:
            # npm forwards termination imperfectly; locate neither other servers
            # nor global ports. Stop only this subprocess group created by tests.
            os.killpg(cls.server.pid, signal.SIGTERM)
            try:
                cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(cls.server.pid, signal.SIGKILL)
                cls.server.wait(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1360, 'height': 1000})
        self.addCleanup(self.context.close)
        self.context.add_init_script(ISOLATION_SCRIPT)
        self.external_requests = []
        self.api_requests = []
        self.context.route('**/*', self.only_static_preview_requests)
        self.page = self.context.new_page()
        self.page_errors = []
        self.console_errors = []
        self.page.on('pageerror', lambda error: self.page_errors.append(str(error)))
        self.page.on('console', lambda message: self.console_errors.append(message.text)
                     if message.type == 'error' else None)

    def only_static_preview_requests(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        if parsed.scheme not in ('http', 'https') or parsed.netloc != urlsplit(self.url).netloc:
            self.external_requests.append(request.url)
            route.abort()
        elif request.resource_type in ('fetch', 'xhr') or parsed.path.startswith('/api/'):
            self.api_requests.append(request.url)
            route.abort()
        else:
            route.continue_()

    def tearDown(self):
        self.assertEqual(self.page_errors, [], 'JavaScript exceptions')
        self.assertEqual(self.console_errors, [], 'Console errors')
        self.assertEqual(self.external_requests, [], 'External network requests')
        self.assertEqual(self.api_requests, [], 'API requests')
        if self.page.url.startswith(self.url):
            self.assertEqual(self.page.evaluate('window.__frontendAudit'),
                             {'storage': [], 'microphone': [], 'synthesis': [], 'sockets': []})

    def open(self, route='/'):
        response = self.page.goto(self.url + '#' + route)
        if response is not None:
            self.assertEqual(response.status, 200)
        else:
            # Fragment-only navigation correctly makes no HTTP document request.
            self.assertEqual(urlsplit(self.page.url).path, '/juno2-preview/')
        expect(self.page).to_have_url(self.url + '#' + route)
        expect(self.page.get_by_test_id('banner-synthetic')).to_be_visible()
        expect(self.page.get_by_test_id('banner-synthetic')).to_contain_text('Synthetic frontend demo')

    def route_and_refresh(self, route, marker):
        self.open(route)
        expect(self.page.get_by_test_id(marker)).to_be_visible()
        response = self.page.reload()
        self.assertEqual(response.status, 200)
        expect(self.page.get_by_test_id(marker)).to_be_visible()
        expect(self.page.get_by_test_id('banner-synthetic')).to_be_visible()

    def test_today_direct_route_refresh_and_development_brand(self):
        self.route_and_refresh('/', 'button-start-free')
        expect(self.page.get_by_test_id('link-brand')).to_contain_text('Juno2')
        self.assertIn('Juno2', self.page.title())

    def test_practice_direct_route_refresh(self):
        self.route_and_refresh('/practice', 'button-begin-conversation')

    def test_conversation_direct_route_refresh(self):
        self.route_and_refresh('/session', 'input-demo-message')

    def test_notes_direct_route_refresh_identifies_mock_reports(self):
        self.route_and_refresh('/notes', 'banner-synthetic-notes')
        expect(self.page.get_by_test_id('banner-synthetic-notes')).to_contain_text('synthetic', ignore_case=True)

    def test_progress_direct_route_refresh_identifies_mock_metrics(self):
        self.route_and_refresh('/progress', 'banner-synthetic-progress')
        expect(self.page.get_by_test_id('banner-synthetic-progress')).to_contain_text('synthetic', ignore_case=True)

    def test_desktop_navigation_and_practice_mode_flow(self):
        self.open()
        for destination in ['practice', 'notes', 'progress', 'today']:
            self.page.get_by_test_id('link-nav-' + destination).click()
            expect(self.page.get_by_test_id('banner-synthetic')).to_be_visible()
            expected = '/' if destination == 'today' else '/' + destination
            expect(self.page).to_have_url(self.url + '#' + expected)
        self.page.get_by_test_id('button-start-scenario').click()
        expect(self.page).to_have_url(self.url + '#/practice?mode=scenario')
        self.page.get_by_test_id('button-begin-conversation').click()
        expect(self.page).to_have_url(self.url + '#/session?mode=scenario')
        expect(self.page.get_by_test_id('input-demo-message')).to_be_visible()

    def test_mobile_navigation_and_no_horizontal_overflow(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.open()
        for destination in ['practice', 'notes', 'progress', 'today']:
            self.page.get_by_test_id('link-mobile-' + destination).click()
            expected = '/' if destination == 'today' else '/' + destination
            expect(self.page).to_have_url(self.url + '#' + expected)
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), destination)
        self.page.get_by_test_id('button-start-free').click()
        self.page.get_by_test_id('button-begin-conversation').click()
        expect(self.page.get_by_test_id('input-demo-message')).to_be_visible()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))

    def test_typing_preserves_mistakes_and_html_as_literal_text(self):
        self.open('/session')
        message = "I, um... yesterday I go office <img src=x onerror=window.syntheticXss=true> and then—"
        self.page.get_by_test_id('input-demo-message').fill(message)
        self.page.get_by_test_id('button-send-demo-message').click()
        expect(self.page.get_by_text(message, exact=True)).to_be_visible()
        expect(self.page.locator('[data-testid^="text-transcript-"]').get_by_text(
            'Mock reply: Thank you. This is a synthetic response; no AI or correction has run.', exact=True)).to_be_visible()
        self.assertFalse(self.page.evaluate('!!window.syntheticXss'))
        self.assertEqual(self.page.locator('[data-testid^="text-transcript-"] img').count(), 0)
        expect(self.page.get_by_test_id('input-demo-message')).to_have_value('')

    def test_empty_messages_and_length_limit(self):
        self.open('/session')
        entry = self.page.get_by_test_id('input-demo-message')
        send = self.page.get_by_test_id('button-send-demo-message')
        expect(send).to_be_disabled()
        entry.fill('   \n   ')
        expect(send).to_be_disabled()
        self.assertEqual(entry.get_attribute('maxlength'), '4000')
        entry.fill('Synthetic exercise: I am working here since two weeks.')
        expect(send).to_be_enabled()

    def test_keyboard_send_and_shift_enter_preserve_newline(self):
        self.open('/session')
        entry = self.page.get_by_test_id('input-demo-message')
        entry.fill('Synthetic first line')
        entry.press('End')
        entry.press('Shift+Enter')
        entry.press_sequentially('Second unfinished line—')
        message = 'Synthetic first line\nSecond unfinished line—'
        expect(entry).to_have_value(message)
        entry.press('Enter')
        expect(self.page.get_by_text(message, exact=True)).to_be_visible()
        expect(entry).to_have_value('')

    def test_pause_stops_clock_and_blocks_submission_until_resume(self):
        self.open('/session')
        self.page.get_by_test_id('input-demo-message').fill('Synthetic unfinished thought')
        self.page.get_by_test_id('button-toggle-pause').click()
        expect(self.page.get_by_test_id('status-session')).to_have_text('Demo paused')
        expect(self.page.get_by_test_id('button-send-demo-message')).to_be_disabled()
        before = self.page.get_by_test_id('text-session-clock').text_content()
        self.page.wait_for_timeout(1100)
        self.assertEqual(self.page.get_by_test_id('text-session-clock').text_content(), before)
        self.page.get_by_test_id('button-toggle-pause').click()
        expect(self.page.get_by_test_id('button-send-demo-message')).to_be_enabled()
        self.page.get_by_test_id('button-send-demo-message').click()
        expect(self.page.get_by_text('Synthetic unfinished thought', exact=True)).to_be_visible()

    def test_end_opens_synthetic_notes_and_next_task_starts_clean_demo(self):
        self.open('/session')
        message = 'Synthetic lesson ending now'
        self.page.get_by_test_id('input-demo-message').fill(message)
        self.page.get_by_test_id('button-send-demo-message').click()
        self.page.get_by_test_id('button-end-session').click()
        expect(self.page).to_have_url(self.url + '#/notes')
        expect(self.page.get_by_test_id('banner-synthetic-notes')).to_be_visible()
        self.page.get_by_test_id('button-next-task').click()
        expect(self.page).to_have_url(self.url + '#/session?mode=coach')
        expect(self.page.get_by_test_id('button-send-demo-message')).to_be_disabled()
        expect(self.page.get_by_text(message, exact=True)).to_have_count(0)

    def test_navigation_preserves_demo_but_reset_and_refresh_discard_it(self):
        self.open('/session')
        message = 'Synthetic browser-only conversation'
        self.page.get_by_test_id('input-demo-message').fill(message)
        self.page.get_by_test_id('button-send-demo-message').click()
        self.page.get_by_test_id('link-nav-practice').click()
        self.page.get_by_test_id('button-begin-conversation').click()
        expect(self.page.get_by_text(message, exact=True)).to_be_visible()
        self.page.get_by_test_id('button-reset-demo').click()
        expect(self.page.get_by_text(message, exact=True)).to_have_count(0)
        self.open('/session')
        self.page.get_by_test_id('input-demo-message').fill(message)
        self.page.get_by_test_id('button-send-demo-message').click()
        self.page.reload()
        expect(self.page.get_by_test_id('input-demo-message')).to_be_visible()
        expect(self.page.get_by_text(message, exact=True)).to_have_count(0)

    def test_playback_controls_explain_unconnected_audio_without_using_it(self):
        self.open('/notes')
        self.page.get_by_test_id('button-play-pronunciation').click()
        expect(self.page.get_by_test_id('status-pronunciation-playback')).to_contain_text('No audio was played')
        self.open('/drill')
        for button in ['button-play-drill', 'button-replay-drill']:
            self.page.get_by_test_id(button).click()
            expect(self.page.get_by_test_id('status-drill-playback')).to_contain_text('not connected', ignore_case=True)
        self.open('/session')
        self.page.get_by_test_id('button-toggle-mute').click()
        expect(self.page.get_by_test_id('button-toggle-mute')).to_contain_text('Unmute visual demo')
        self.page.get_by_test_id('button-help').click()
        expect(self.page.get_by_test_id('status-help')).to_contain_text('Synthetic phrase example')


if __name__ == '__main__':
    unittest.main(verbosity=2)
