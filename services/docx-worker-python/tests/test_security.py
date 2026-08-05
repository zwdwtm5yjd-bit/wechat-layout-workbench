from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from docx_worker import DocxParseError, DocxSecurityError, parse_docx

from docx_fixture import CONTENT_TYPES, ROOT_RELS, standard_document_xml, write_docx


class DocxSecurityTest(unittest.TestCase):
    def test_rejects_non_docx_extension(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "renamed.zip")
            with self.assertRaises(DocxParseError):
                parse_docx(source)

    def test_rejects_zip_path_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "traversal.docx"
            with ZipFile(source, "w", compression=ZIP_DEFLATED) as package:
                package.writestr("[Content_Types].xml", CONTENT_TYPES)
                package.writestr("_rels/.rels", ROOT_RELS)
                package.writestr("word/document.xml", standard_document_xml())
                package.writestr("../outside.txt", "should never be read")
            with self.assertRaises(DocxSecurityError) as caught:
                parse_docx(source)
            self.assertEqual(caught.exception.details["reason"], "path_traversal")

    def test_rejects_xml_entities(self) -> None:
        malicious = """<?xml version="1.0"?>
<!DOCTYPE w:document [<!ENTITY payload "forbidden">]>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&payload;</w:t></w:r></w:p></w:body></w:document>"""
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "entity.docx", document_xml=malicious)
            with self.assertRaises(DocxSecurityError) as caught:
                parse_docx(source)
            self.assertEqual(caught.exception.details["reason"], "xml_entity_or_doctype")

    def test_rejects_macro_and_embedded_object_parts(self) -> None:
        for part in ["word/vbaProject.bin", "word/embeddings/oleObject1.bin"]:
            with self.subTest(part=part), tempfile.TemporaryDirectory() as temporary:
                source = write_docx(
                    Path(temporary) / "active.docx",
                    extra_entries={part: b"unsafe"},
                )
                with self.assertRaises(DocxSecurityError):
                    parse_docx(source)


if __name__ == "__main__":
    unittest.main()
