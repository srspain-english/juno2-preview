#!/usr/bin/env python3
"""Run the standalone frontend tests without inheriting runtime credentials."""

import os
from pathlib import Path
import socket
import sys
import unittest
from unittest import mock


def main() -> int:
    sys.dont_write_bytecode = True
    tests = Path(__file__).resolve().parent
    sys.path.insert(0, str(tests))
    # Test runner is a standalone process. Preserve PATH for npm/node and avoid
    # exposing Juno/Render/Anthropic configuration to the static preview.
    for name in list(os.environ):
        if name.startswith(('JUNO_', 'ANTHROPIC_', 'RENDER')) or name in ('PORT', 'DATABASE_URL'):
            os.environ.pop(name)
    real_connect = socket.socket.connect
    real_connect_ex = socket.socket.connect_ex

    def loopback_only(method):
        def connect(sock, address):
            if not isinstance(address, tuple) or address[0] not in ('127.0.0.1', '::1', 'localhost'):
                raise AssertionError('Frontend tests may connect only to loopback')
            return method(sock, address)
        return connect

    with mock.patch.object(socket.socket, 'connect', loopback_only(real_connect)), \
            mock.patch.object(socket.socket, 'connect_ex', loopback_only(real_connect_ex)):
        suite = unittest.defaultTestLoader.discover(str(tests), pattern='test_*.py')
        result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    raise SystemExit(main())
