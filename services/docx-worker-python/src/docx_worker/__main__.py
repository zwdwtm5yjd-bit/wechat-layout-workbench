"""Command-line boundary for deterministic DOCX parsing jobs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .errors import DocxError
from .parser import parse_docx


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="docx-worker",
        description="Safely parse a Word/WPS DOCX into DOCX Intermediate v1 JSON.",
    )
    parser.add_argument("input", type=Path, help="Path to the source .docx file")
    parser.add_argument(
        "--extract-dir",
        type=Path,
        help="Optional directory for extracted image payloads",
    )
    parser.add_argument(
        "--retain-original-dir",
        type=Path,
        help="Optional directory that receives a retained original.docx copy",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    parser.add_argument("--version", action="version", version=__version__)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _argument_parser().parse_args(argv)
    try:
        result = parse_docx(
            args.input,
            extract_directory=args.extract_dir,
            retain_original_directory=args.retain_original_dir,
        )
    except DocxError as error:
        sys.stderr.write(json.dumps({"success": False, "error": error.to_dict()}, ensure_ascii=False))
        sys.stderr.write("\n")
        return 2
    except OSError as error:
        payload = {
            "success": False,
            "error": {
                "code": "DOCX_IO_FAILED",
                "message": str(error),
                "retryable": True,
                "details": {},
            },
        }
        sys.stderr.write(json.dumps(payload, ensure_ascii=False))
        sys.stderr.write("\n")
        return 3
    json.dump(
        {"success": True, "data": result},
        sys.stdout,
        ensure_ascii=False,
        indent=2 if args.pretty else None,
        separators=None if args.pretty else (",", ":"),
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
