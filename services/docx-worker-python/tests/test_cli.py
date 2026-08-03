from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from docx_worker.__main__ import main

from docx_fixture import write_docx


class DocxCliTest(unittest.TestCase):
    def test_prints_machine_readable_success(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "input.docx", application="WPS Office")
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                exit_code = main([str(source)])
            payload = json.loads(stdout.getvalue())
            self.assertEqual(exit_code, 0)
            self.assertTrue(payload["success"])
            self.assertEqual(payload["data"]["detectedSource"], "wps")

    def test_prints_typed_error_without_traceback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "broken.docx"
            source.write_text("not a zip", encoding="utf-8")
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                exit_code = main([str(source)])
            payload = json.loads(stderr.getvalue())
            self.assertEqual(exit_code, 2)
            self.assertFalse(payload["success"])
            self.assertEqual(payload["error"]["code"], "DOCX_INVALID_PACKAGE")


if __name__ == "__main__":
    unittest.main()
