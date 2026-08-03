from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from docx_worker import parse_docx

from docx_fixture import image_paragraph, paragraph, write_docx


class DocxParserAcceptanceTest(unittest.TestCase):
    def test_imports_standard_word_document_with_ordered_structure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = write_docx(root / "word-sample.docx")
            result = parse_docx(
                source,
                extract_directory=root / "images",
                retain_original_directory=root / "retained",
            )

            self.assertEqual(result["schemaVersion"], "1.0.0")
            self.assertEqual(result["detectedSource"], "word")
            self.assertEqual(result["title"], "测试文章")
            blocks = result["sourceBlocks"]
            self.assertEqual(
                [block["role"] for block in blocks],
                [
                    "title",
                    "heading_1",
                    "ordered_item",
                    "ordered_item",
                    "paragraph",
                    "image_reference",
                    "paragraph",
                    "image_reference",
                ],
            )
            self.assertEqual(blocks[2]["relationMetadata"]["originalNumberText"], "1.")
            self.assertEqual(blocks[3]["relationMetadata"]["originalNumberText"], "2.")
            self.assertEqual(
                blocks[3]["styleMetadata"]["inlineContent"][0]["marks"],
                [{"type": "bold"}],
            )
            self.assertEqual(
                blocks[4]["styleMetadata"]["inlineContent"][0]["marks"],
                [{"type": "link", "attrs": {"href": "https://example.com/read"}}],
            )
            self.assertEqual(
                [block["relationMetadata"]["resourceKey"] for block in blocks if block["role"] == "image_reference"],
                ["image_0001", "image_0002"],
            )
            self.assertEqual(
                [resource["originalFilename"] for resource in result["resources"]],
                ["image1.png", "image2.png"],
            )
            self.assertTrue((root / "images" / "image_0001.png").is_file())
            self.assertEqual((root / "retained" / "original.docx").read_bytes(), source.read_bytes())

            tables = result["tables"]
            self.assertEqual(len(tables), 1)
            self.assertEqual(tables[0]["rows"], [["姓名", "职责"], ["小王", "设计"]])
            self.assertEqual(tables[0]["rowCount"], 2)
            self.assertEqual(tables[0]["columnCount"], 2)
            self.assertEqual(result["statistics"]["imageCount"], 2)
            self.assertEqual(result["statistics"]["tableCount"], 1)

    def test_detects_wps_saved_docx(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "wps.docx", application="WPS Office")
            result = parse_docx(source)
            self.assertEqual(result["detectedSource"], "wps")
            self.assertEqual(result["statistics"]["headingCount"], 1)

    def test_is_deterministic_for_the_same_document(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "same.docx")
            first = parse_docx(source)
            second = parse_docx(source)
            self.assertEqual(first, second)

    def test_keeps_repeated_image_occurrences_while_deduplicating_payloads(self) -> None:
        document = f"""<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
 {paragraph("重复图片")}{image_paragraph("rImg1", "第一次")}{image_paragraph("rImg1", "第二次")}
 </w:body></w:document>"""
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "repeated.docx", document_xml=document)
            result = parse_docx(source)
            image_blocks = [
                block for block in result["sourceBlocks"] if block["role"] == "image_reference"
            ]
            self.assertEqual(len(image_blocks), 2)
            self.assertEqual(len(result["resources"]), 1)
            self.assertEqual(result["resources"][0]["occurrenceCount"], 2)
            self.assertEqual(
                [block["relationMetadata"]["alt"] for block in image_blocks],
                ["第一次", "第二次"],
            )

    def test_inline_content_matches_normalized_source_text_across_mark_boundaries(self) -> None:
        document = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:r><w:t xml:space="preserve">  标记   </w:t></w:r>
  <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">  内容  </w:t></w:r></w:p>
</w:body></w:document>"""
        with tempfile.TemporaryDirectory() as temporary:
            source = write_docx(Path(temporary) / "inline.docx", document_xml=document)
            result = parse_docx(source)
            block = result["sourceBlocks"][0]
            inline = block["styleMetadata"]["inlineContent"]
            self.assertEqual(block["text"], "标记 内容")
            self.assertEqual("".join(node["text"] for node in inline), block["text"])
            self.assertEqual(inline[1]["marks"], [{"type": "bold"}])


if __name__ == "__main__":
    unittest.main()
