"""Typed errors emitted by the DOCX parser and command-line boundary."""

from __future__ import annotations


class DocxError(Exception):
    """Base error with a stable machine-readable code."""

    code = "DOCX_PARSE_FAILED"

    def __init__(self, message: str, *, details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.details = details or {}

    def to_dict(self) -> dict[str, object]:
        return {
            "code": self.code,
            "message": str(self),
            "retryable": False,
            "details": self.details,
        }


class DocxSecurityError(DocxError):
    """The archive contains a construct that must not be processed."""

    code = "DOCX_SECURITY_REJECTED"


class DocxLimitError(DocxError):
    """The archive exceeds a configured parser limit."""

    code = "DOCX_LIMIT_EXCEEDED"


class DocxParseError(DocxError):
    """The package is malformed or is not a supported DOCX document."""

    code = "DOCX_INVALID_PACKAGE"
