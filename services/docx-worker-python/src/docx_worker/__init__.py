"""Safe DOCX parsing primitives used by the import worker."""

from .errors import DocxError, DocxParseError, DocxSecurityError
from .parser import parse_docx

__all__ = [
    "DocxError",
    "DocxParseError",
    "DocxSecurityError",
    "parse_docx",
]

__version__ = "0.1.0"
