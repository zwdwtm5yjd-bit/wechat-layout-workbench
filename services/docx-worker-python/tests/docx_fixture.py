"""Small, standards-shaped OOXML fixtures for parser acceptance tests."""

from __future__ import annotations

import base64
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr>
  </w:style>
</w:styles>"""

NUMBERING = """<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:suff w:val="space"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1.%2."/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""

DOCUMENT_RELS = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
  <Relationship Id="rImg2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>
  <Relationship Id="rLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/read" TargetMode="External"/>
</Relationships>"""


def paragraph(text: str, *, style: str | None = None, number_id: str | None = None, bold: bool = False) -> str:
    style_xml = f'<w:pStyle w:val="{style}"/>' if style else ""
    number_xml = (
        f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{number_id}"/></w:numPr>'
        if number_id
        else ""
    )
    properties = f"<w:pPr>{style_xml}{number_xml}</w:pPr>" if style_xml or number_xml else ""
    run_properties = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return f'<w:p>{properties}<w:r>{run_properties}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>'


def image_paragraph(relationship_id: str, description: str) -> str:
    return f"""<w:p><w:r><w:drawing><wp:inline>
      <wp:docPr id="1" name="Picture" descr="{description}"/>
      <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="{relationship_id}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>
    </wp:inline></w:drawing></w:r></w:p>"""


def standard_document_xml() -> str:
    table = """<w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>职责</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>小王</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>设计</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>"""
    body = "".join(
        [
            paragraph("测试文章", style="Title"),
            paragraph("第一部分", style="Heading1"),
            paragraph("第一项", number_id="1"),
            paragraph("第二项", number_id="1", bold=True),
            '<w:p><w:hyperlink r:id="rLink"><w:r><w:t>阅读原文</w:t></w:r></w:hyperlink></w:p>',
            image_paragraph("rImg1", "头图"),
            table,
            image_paragraph("rImg2", "表格后配图"),
        ]
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
 <w:body>{body}<w:sectPr/></w:body>
</w:document>"""


def write_docx(
    path: Path,
    *,
    document_xml: str | None = None,
    application: str = "Microsoft Office Word",
    extra_entries: dict[str, bytes | str] | None = None,
) -> Path:
    app_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>{application}</Application></Properties>"""
    entries: dict[str, bytes | str] = {
        "[Content_Types].xml": CONTENT_TYPES,
        "_rels/.rels": ROOT_RELS,
        "word/document.xml": document_xml or standard_document_xml(),
        "word/_rels/document.xml.rels": DOCUMENT_RELS,
        "word/styles.xml": STYLES,
        "word/numbering.xml": NUMBERING,
        "word/media/image1.png": PNG_1X1,
        "word/media/image2.png": PNG_1X1 + b"second",
        "docProps/app.xml": app_xml,
    }
    entries.update(extra_entries or {})
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as package:
        for name, payload in entries.items():
            package.writestr(name, payload)
    return path
