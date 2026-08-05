"""Safe OOXML parsing into the frozen DOCX Intermediate v1 contract."""

from __future__ import annotations

import hashlib
import json
import mimetypes
import posixpath
import re
import shutil
import unicodedata
from collections.abc import Iterator
from pathlib import Path, PurePosixPath
from urllib.parse import unquote
from xml.etree import ElementTree as ET

from .archive import SafeDocxArchive
from .errors import DocxLimitError, DocxParseError, DocxSecurityError
from .models import (
    NumberingDefinition,
    NumberingLevel,
    Relationship,
    StyleDefinition,
    WarningCollector,
)

SCHEMA_VERSION = "1.0.0"
PARSER_VERSION = "0.1.0"
MAX_IMAGE_COUNT = 100

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dc": "http://purl.org/dc/elements/1.1/",
    "ep": "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
}

W = f"{{{NS['w']}}}"
R = f"{{{NS['r']}}}"
REL = f"{{{NS['rel']}}}"
A = f"{{{NS['a']}}}"
V = f"{{{NS['v']}}}"
WP = f"{{{NS['wp']}}}"

MACRO_OR_ACTIVE_PREFIXES = (
    "word/activeX/",
    "word/embeddings/",
)
MACRO_OR_ACTIVE_PARTS = frozenset(
    {
        "word/vbaProject.bin",
        "word/vbaData.xml",
    }
)
MACRO_CONTENT_TYPE_MARKERS = (
    "macroenabled",
    "vnd.ms-word.document.macroenabled",
    "vnd.ms-office.vbaproject",
    "activex",
    "oleobject",
)


def _attr(element: ET.Element | None, namespace: str, name: str) -> str | None:
    if element is None:
        return None
    return element.get(f"{{{NS[namespace]}}}{name}")


def _w_attr(element: ET.Element | None, name: str) -> str | None:
    return _attr(element, "w", name)


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_text(value: str) -> str:
    return _sha256_bytes(value.encode("utf-8"))


def _parse_xml(payload: bytes, part: str) -> ET.Element:
    upper = payload.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise DocxSecurityError(
            "DOCX XML 包含禁止的实体或 DTD",
            details={"part": part, "reason": "xml_entity_or_doctype"},
        )
    try:
        return ET.fromstring(payload)
    except ET.ParseError as error:
        raise DocxParseError(
            "DOCX XML 结构损坏",
            details={"part": part, "line": error.position[0], "column": error.position[1]},
        ) from error


def _clean_text(value: str) -> str:
    cleaned = "".join(
        character
        for character in value
        if not (
            ord(character) <= 8
            or ord(character) in {11, 12, 127}
            or 14 <= ord(character) <= 31
            or 0x200B <= ord(character) <= 0x200D
            or ord(character) == 0xFEFF
        )
    )
    return re.sub(r"[ \t\f\v]+", " ", cleaned.replace("\r\n", "\n").replace("\r", "\n"))


def _normalized_text(value: str) -> str:
    return _clean_text(value).strip()


def _count_words(value: str) -> int:
    latin_words = len(re.findall(r"[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*", value))
    cjk_characters = sum(1 for character in value if "CJK" in unicodedata.name(character, ""))
    return latin_words + cjk_characters


def _safe_relationship_target(source_part: str, target: str) -> str:
    decoded = unquote(target).replace("\\", "/")
    if "\0" in decoded or decoded.startswith("/") or re.match(r"^[A-Za-z]:", decoded):
        raise DocxSecurityError(
            "DOCX 关系指向非法路径",
            details={"sourcePart": source_part, "target": target},
        )
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(source_part), decoded))
    if resolved == ".." or resolved.startswith("../"):
        raise DocxSecurityError(
            "DOCX 关系越出 OOXML 包根目录",
            details={"sourcePart": source_part, "target": target},
        )
    return resolved


def _parse_relationships(archive: SafeDocxArchive, source_part: str) -> dict[str, Relationship]:
    source = PurePosixPath(source_part)
    relationship_part = str(source.parent / "_rels" / f"{source.name}.rels")
    if not archive.has(relationship_part):
        return {}
    root = _parse_xml(archive.read(relationship_part, xml=True), relationship_part)
    relationships: dict[str, Relationship] = {}
    for element in root.findall(f"{REL}Relationship"):
        relationship_id = element.get("Id")
        relationship_type = element.get("Type")
        target = element.get("Target")
        target_mode = element.get("TargetMode", "Internal")
        if not relationship_id or not relationship_type or target is None:
            raise DocxParseError(
                "DOCX 关系部件字段不完整",
                details={"part": relationship_part},
            )
        if relationship_id in relationships:
            raise DocxParseError(
                "DOCX 包含重复关系 ID",
                details={"part": relationship_part, "relationshipId": relationship_id},
            )
        archive_path = (
            None
            if target_mode.lower() == "external"
            else _safe_relationship_target(source_part, target)
        )
        relationships[relationship_id] = Relationship(
            relationship_id=relationship_id,
            relationship_type=relationship_type,
            target=target,
            target_mode=target_mode,
            archive_path=archive_path,
        )
    return relationships


def _parse_content_types(archive: SafeDocxArchive) -> tuple[dict[str, str], dict[str, str]]:
    part = "[Content_Types].xml"
    root = _parse_xml(archive.read(part, xml=True), part)
    defaults: dict[str, str] = {}
    overrides: dict[str, str] = {}
    for child in root:
        local_name = child.tag.rsplit("}", 1)[-1]
        content_type = child.get("ContentType", "").strip().lower()
        if any(marker in content_type for marker in MACRO_CONTENT_TYPE_MARKERS):
            raise DocxSecurityError(
                "DOCX 包含宏、ActiveX 或嵌入对象",
                details={"contentType": content_type},
            )
        if local_name == "Default":
            extension = child.get("Extension", "").lower()
            if extension:
                defaults[extension] = content_type
        elif local_name == "Override":
            part_name = child.get("PartName", "").lstrip("/")
            if part_name:
                overrides[part_name] = content_type
    document_type = overrides.get("word/document.xml", "")
    if document_type and document_type != (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    ):
        raise DocxParseError(
            "只支持标准 .docx 文档",
            details={"documentContentType": document_type},
        )
    return defaults, overrides


def _reject_active_content(archive: SafeDocxArchive) -> None:
    for name in archive.names:
        lower = name.lower()
        if lower in {entry.lower() for entry in MACRO_OR_ACTIVE_PARTS} or lower.startswith(
            tuple(prefix.lower() for prefix in MACRO_OR_ACTIVE_PREFIXES)
        ):
            raise DocxSecurityError(
                "DOCX 包含宏、ActiveX 或嵌入对象",
                details={"part": name},
            )


def _parse_styles(archive: SafeDocxArchive) -> dict[str, StyleDefinition]:
    part = "word/styles.xml"
    if not archive.has(part):
        return {}
    root = _parse_xml(archive.read(part, xml=True), part)
    styles: dict[str, StyleDefinition] = {}
    for element in root.findall(f"{W}style"):
        if _w_attr(element, "type") != "paragraph":
            continue
        style_id = _w_attr(element, "styleId")
        if not style_id:
            continue
        styles[style_id] = StyleDefinition(
            style_id=style_id,
            name=_w_attr(element.find(f"{W}name"), "val") or style_id,
            based_on=_w_attr(element.find(f"{W}basedOn"), "val"),
            outline_level=_integer_attribute(element.find(f"{W}pPr/{W}outlineLvl"), "val"),
        )
    return styles


def _integer_attribute(element: ET.Element | None, name: str, default: int | None = None) -> int | None:
    value = _w_attr(element, name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _numbering_level(element: ET.Element, level: int) -> NumberingLevel:
    return NumberingLevel(
        level=level,
        number_format=_w_attr(element.find(f"{W}numFmt"), "val") or "decimal",
        level_text=_w_attr(element.find(f"{W}lvlText"), "val") or f"%{level + 1}.",
        start=_integer_attribute(element.find(f"{W}start"), "val", 1) or 1,
        suffix=_w_attr(element.find(f"{W}suff"), "val") or "tab",
    )


def _parse_numbering(archive: SafeDocxArchive) -> dict[str, NumberingDefinition]:
    part = "word/numbering.xml"
    if not archive.has(part):
        return {}
    root = _parse_xml(archive.read(part, xml=True), part)
    abstracts: dict[str, dict[int, NumberingLevel]] = {}
    for abstract in root.findall(f"{W}abstractNum"):
        abstract_id = _w_attr(abstract, "abstractNumId")
        if abstract_id is None:
            continue
        levels: dict[int, NumberingLevel] = {}
        for element in abstract.findall(f"{W}lvl"):
            level = _integer_attribute(element, "ilvl", 0) or 0
            levels[level] = _numbering_level(element, level)
        abstracts[abstract_id] = levels

    definitions: dict[str, NumberingDefinition] = {}
    for number in root.findall(f"{W}num"):
        number_id = _w_attr(number, "numId")
        abstract_id = _w_attr(number.find(f"{W}abstractNumId"), "val")
        if number_id is None or abstract_id is None:
            continue
        levels = dict(abstracts.get(abstract_id, {}))
        for override in number.findall(f"{W}lvlOverride"):
            level = _integer_attribute(override, "ilvl", 0) or 0
            explicit = override.find(f"{W}lvl")
            if explicit is not None:
                levels[level] = _numbering_level(explicit, level)
            start_override = _integer_attribute(override.find(f"{W}startOverride"), "val")
            if start_override is not None:
                base = levels.get(level, NumberingLevel(level, "decimal", f"%{level + 1}.", 1, "tab"))
                levels[level] = NumberingLevel(
                    level=base.level,
                    number_format=base.number_format,
                    level_text=base.level_text,
                    start=start_override,
                    suffix=base.suffix,
                )
        definitions[number_id] = NumberingDefinition(number_id=number_id, levels=levels)
    return definitions


def _style_outline_level(style_id: str, styles: dict[str, StyleDefinition]) -> int | None:
    visited: set[str] = set()
    current = styles.get(style_id)
    while current is not None and current.style_id not in visited:
        visited.add(current.style_id)
        if current.outline_level is not None:
            return current.outline_level
        current = styles.get(current.based_on or "")
    return None


def _heading_role(style_id: str | None, styles: dict[str, StyleDefinition]) -> str | None:
    if style_id is None:
        return None
    style = styles.get(style_id)
    name = (style.name if style else style_id).strip()
    normalized = re.sub(r"[\s_-]+", "", name).lower()
    if normalized in {"title", "documenttitle", "文档标题", "主标题"}:
        return "title"
    if normalized in {"subtitle", "副标题"}:
        return "subtitle"
    match = re.search(r"(?:heading|标题)([1-9])", normalized)
    level = int(match.group(1)) if match else None
    if level is None:
        outline = _style_outline_level(style_id, styles)
        level = None if outline is None else outline + 1
    if level is None:
        return None
    return f"heading_{min(3, max(1, level))}"


def _format_number(value: int, number_format: str) -> str:
    if number_format == "decimal" or number_format.startswith("decimal"):
        return str(value)
    if number_format in {"lowerLetter", "upperLetter"}:
        result = ""
        current = max(1, value)
        while current:
            current, remainder = divmod(current - 1, 26)
            result = chr(ord("a") + remainder) + result
        return result.upper() if number_format == "upperLetter" else result
    if number_format in {"lowerRoman", "upperRoman"}:
        pairs = (
            (1000, "M"),
            (900, "CM"),
            (500, "D"),
            (400, "CD"),
            (100, "C"),
            (90, "XC"),
            (50, "L"),
            (40, "XL"),
            (10, "X"),
            (9, "IX"),
            (5, "V"),
            (4, "IV"),
            (1, "I"),
        )
        current = max(1, value)
        result = ""
        for amount, numeral in pairs:
            while current >= amount:
                result += numeral
                current -= amount
        return result if number_format == "upperRoman" else result.lower()
    return str(value)


class _NumberingState:
    def __init__(self, definitions: dict[str, NumberingDefinition]) -> None:
        self.definitions = definitions
        self.counters: dict[str, dict[int, int]] = {}

    def advance(self, number_id: str, level: int) -> tuple[NumberingLevel, str]:
        definition = self.definitions.get(number_id)
        numbering_level = (
            definition.levels.get(level)
            if definition is not None
            else None
        ) or NumberingLevel(level, "decimal", f"%{level + 1}.", 1, "tab")
        counters = self.counters.setdefault(number_id, {})
        for deeper in [entry for entry in counters if entry > level]:
            del counters[deeper]
        counters[level] = counters.get(level, numbering_level.start - 1) + 1
        label = numbering_level.level_text
        for referenced_level in range(9):
            value = counters.get(referenced_level)
            referenced = (
                definition.levels.get(referenced_level)
                if definition is not None
                else None
            ) or NumberingLevel(referenced_level, "decimal", f"%{referenced_level + 1}.", 1, "tab")
            if value is None:
                value = referenced.start
            label = label.replace(
                f"%{referenced_level + 1}",
                _format_number(value, referenced.number_format),
            )
        return numbering_level, label


def _run_marks(run: ET.Element, hyperlink: str | None = None) -> list[dict[str, object]]:
    properties = run.find(f"{W}rPr")
    marks: list[dict[str, object]] = []
    if properties is not None:
        if properties.find(f"{W}b") is not None:
            marks.append({"type": "bold"})
        if properties.find(f"{W}i") is not None:
            marks.append({"type": "italic"})
        if properties.find(f"{W}u") is not None:
            marks.append({"type": "underline"})
        if properties.find(f"{W}strike") is not None or properties.find(f"{W}dstrike") is not None:
            marks.append({"type": "strike"})
    if hyperlink is not None:
        marks.append({"type": "link", "attrs": {"href": hyperlink}})
    return marks


def _run_is_hidden(run: ET.Element) -> bool:
    properties = run.find(f"{W}rPr")
    return properties is not None and properties.find(f"{W}vanish") is not None


def _run_text(run: ET.Element) -> str:
    result: list[str] = []
    for element in run.iter():
        if element.tag in {f"{W}t", f"{W}delText"}:
            result.append(element.text or "")
        elif element.tag == f"{W}tab":
            result.append("\t")
        elif element.tag in {f"{W}br", f"{W}cr"}:
            result.append("\n")
        elif element.tag == f"{W}noBreakHyphen":
            result.append("‑")
        elif element.tag == f"{W}softHyphen":
            result.append("­")
    return "".join(result)


def _safe_hyperlink(relationship: Relationship | None) -> str | None:
    if relationship is None or relationship.target_mode.lower() != "external":
        return None
    target = relationship.target.strip()
    return target if re.match(r"^(?:https?://|mailto:)[^\s]+$", target, re.IGNORECASE) else None


def _iter_runs(
    parent: ET.Element,
    relationships: dict[str, Relationship],
    warnings: WarningCollector,
    hyperlink: str | None = None,
) -> Iterator[tuple[ET.Element, str | None]]:
    for child in parent:
        if child.tag in {f"{W}del", f"{W}moveFrom"}:
            continue
        if child.tag == f"{W}r":
            yield child, hyperlink
            continue
        if child.tag == f"{W}hyperlink":
            relationship_id = _attr(child, "r", "id")
            relationship = relationships.get(relationship_id or "")
            safe_target = _safe_hyperlink(relationship)
            if relationship_id and safe_target is None:
                warnings.add("UNSAFE_LINK_REMOVED", "已移除不安全或无效的外部链接")
            yield from _iter_runs(child, relationships, warnings, safe_target)
            continue
        yield from _iter_runs(child, relationships, warnings, hyperlink)


def _inline_content(
    paragraph: ET.Element,
    relationships: dict[str, Relationship],
    warnings: WarningCollector,
) -> tuple[str, list[dict[str, object]]]:
    inline: list[dict[str, object]] = []
    hidden_count = 0
    for run, hyperlink in _iter_runs(paragraph, relationships, warnings):
        if _run_is_hidden(run):
            hidden_count += 1
            continue
        text = _run_text(run)
        if not text:
            continue
        marks = _run_marks(run, hyperlink)
        node: dict[str, object] = {"type": "text", "text": text}
        if marks:
            node["marks"] = marks
        previous = inline[-1] if inline else None
        if (
            previous is not None
            and previous.get("type") == "text"
            and previous.get("marks", []) == node.get("marks", [])
        ):
            previous["text"] = str(previous.get("text", "")) + text
        else:
            inline.append(node)
    if hidden_count:
        warnings.add(
            "HIDDEN_CONTENT_REMOVED",
            "已移除 Word/WPS 隐藏文字",
            count=hidden_count,
        )
    normalized_inline: list[dict[str, object]] = []
    for node in inline:
        cleaned_text = _clean_text(str(node["text"]))
        if normalized_inline and str(normalized_inline[-1]["text"]).endswith(" "):
            cleaned_text = cleaned_text.lstrip(" ")
        if not cleaned_text:
            continue
        normalized_node = {**node, "text": cleaned_text}
        previous = normalized_inline[-1] if normalized_inline else None
        if previous is not None and previous.get("marks", []) == normalized_node.get("marks", []):
            previous["text"] = str(previous["text"]) + cleaned_text
        else:
            normalized_inline.append(normalized_node)
    while normalized_inline and not str(normalized_inline[0]["text"]).lstrip():
        normalized_inline.pop(0)
    while normalized_inline and not str(normalized_inline[-1]["text"]).rstrip():
        normalized_inline.pop()
    if normalized_inline:
        normalized_inline[0]["text"] = str(normalized_inline[0]["text"]).lstrip()
        normalized_inline[-1]["text"] = str(normalized_inline[-1]["text"]).rstrip()
    text = "".join(str(node["text"]) for node in normalized_inline)
    if not text:
        return "", []
    return text, normalized_inline


def _image_references(parent: ET.Element) -> list[tuple[str, str]]:
    references: list[tuple[str, str]] = []
    for drawing in parent.iter(f"{W}drawing"):
        descriptions: dict[str, str] = {}
        for doc_properties in drawing.iter(f"{WP}docPr"):
            description = (
                doc_properties.get("descr")
                or doc_properties.get("title")
                or doc_properties.get("name")
                or ""
            )
            for blip in drawing.iter(f"{A}blip"):
                relationship_id = blip.get(f"{R}embed") or blip.get(f"{R}link")
                if relationship_id:
                    descriptions.setdefault(relationship_id, description)
        for blip in drawing.iter(f"{A}blip"):
            relationship_id = blip.get(f"{R}embed") or blip.get(f"{R}link")
            if relationship_id:
                references.append((relationship_id, descriptions.get(relationship_id, "")))
    for picture in parent.iter(f"{W}pict"):
        for image_data in picture.iter(f"{V}imagedata"):
            relationship_id = image_data.get(f"{R}id")
            if relationship_id:
                references.append(
                    (
                        relationship_id,
                        image_data.get(f"{V}title") or image_data.get("title") or "",
                    )
                )
    return references


def _paragraph_numbering(paragraph: ET.Element) -> tuple[str, int] | None:
    properties = paragraph.find(f"{W}pPr")
    number_properties = properties.find(f"{W}numPr") if properties is not None else None
    if number_properties is None:
        return None
    number_id = _w_attr(number_properties.find(f"{W}numId"), "val")
    level = _integer_attribute(number_properties.find(f"{W}ilvl"), "val", 0) or 0
    return (number_id, level) if number_id is not None else None


def _paragraph_style(paragraph: ET.Element) -> str | None:
    properties = paragraph.find(f"{W}pPr")
    return _w_attr(properties.find(f"{W}pStyle"), "val") if properties is not None else None


def _source_block_id(order_index: int, source_type: str, text: str, identity: str = "") -> str:
    digest = _sha256_text(f"{order_index}\0{source_type}\0{text}\0{identity}")[:12]
    return f"src_{order_index + 1:06d}_{digest}"


def _relationship_is_image(relationship: Relationship) -> bool:
    return relationship.relationship_type.lower().endswith("/image")


def _detected_raster_type(payload: bytes) -> tuple[str, str] | None:
    if payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if payload.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if payload.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif", "gif"
    if len(payload) >= 12 and payload.startswith(b"RIFF") and payload[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


class _DocumentBuilder:
    def __init__(
        self,
        archive: SafeDocxArchive,
        relationships: dict[str, Relationship],
        styles: dict[str, StyleDefinition],
        numbering: dict[str, NumberingDefinition],
        content_type_defaults: dict[str, str],
        content_type_overrides: dict[str, str],
        warnings: WarningCollector,
        extract_directory: Path | None,
    ) -> None:
        self.archive = archive
        self.relationships = relationships
        self.styles = styles
        self.numbering = numbering
        self.numbering_state = _NumberingState(numbering)
        self.content_type_defaults = content_type_defaults
        self.content_type_overrides = content_type_overrides
        self.warnings = warnings
        self.extract_directory = extract_directory
        self.blocks: list[dict[str, object]] = []
        self.resources: list[dict[str, object]] = []
        self.tables: list[dict[str, object]] = []
        self._resource_by_path: dict[str, dict[str, object]] = {}
        self._image_occurrences = 0

    def add_paragraph(self, paragraph: ET.Element) -> None:
        text, inline = _inline_content(paragraph, self.relationships, self.warnings)
        style_id = _paragraph_style(paragraph)
        role = _heading_role(style_id, self.styles) or "paragraph"
        numbering_value = _paragraph_numbering(paragraph)
        relation: dict[str, object] = {}
        if numbering_value is not None and role == "paragraph":
            number_id, level = numbering_value
            definition = self.numbering.get(number_id)
            numbering_level, label = self.numbering_state.advance(number_id, level)
            number_format = numbering_level.number_format
            role = "bullet_item" if number_format == "bullet" else "ordered_item"
            relation.update(
                {
                    "listDepth": level,
                    "listStart": numbering_level.start,
                    "originalNumberText": label,
                    "numberingId": number_id,
                    "numberFormat": number_format,
                }
            )
            if definition is None:
                self.warnings.add(
                    "UNSUPPORTED_STRUCTURE_FLATTENED",
                    "编号定义缺失，已按十进制列表保留",
                )
        if text:
            style_metadata: dict[str, object] = {}
            if style_id is not None:
                style_metadata["paragraphStyleId"] = style_id
                style_metadata["paragraphStyleName"] = self.styles.get(
                    style_id,
                    StyleDefinition(style_id, style_id, None, None),
                ).name
            if inline:
                style_metadata["inlineContent"] = inline
            self._append_block(
                source_type=role,
                role=role,
                text=text,
                style_metadata=style_metadata,
                relation_metadata=relation,
            )
        for relationship_id, alt in _image_references(paragraph):
            self._append_image(relationship_id, alt)

    def add_table(self, table: ET.Element) -> None:
        rows: list[list[str]] = []
        merged = False
        image_references: list[tuple[str, str]] = []
        for row in table.findall(f"{W}tr"):
            cells: list[str] = []
            for cell in row.findall(f"{W}tc"):
                cell_parts: list[str] = []
                for paragraph in cell.findall(f".//{W}p"):
                    text, _inline = _inline_content(paragraph, self.relationships, self.warnings)
                    if text:
                        cell_parts.append(text)
                    image_references.extend(_image_references(paragraph))
                cells.append("\n".join(cell_parts))
                properties = cell.find(f"{W}tcPr")
                if properties is not None and (
                    properties.find(f"{W}vMerge") is not None
                    or (_integer_attribute(properties.find(f"{W}gridSpan"), "val", 1) or 1) != 1
                ):
                    merged = True
            rows.append(cells)
        table_id = f"table_{len(self.tables) + 1:04d}"
        flattened = [cell for row in rows for cell in row]
        display_text = "\n".join(" | ".join(row) for row in rows).strip()
        block = self._append_block(
            source_type="table",
            role="paragraph",
            text=display_text,
            style_metadata={"originalTag": "table"},
            relation_metadata={"tableId": table_id, "tableCells": flattened},
            allow_empty=True,
        )
        self.tables.append(
            {
                "tableId": table_id,
                "sourceBlockId": block["sourceBlockId"],
                "rows": rows,
                "rowCount": len(rows),
                "columnCount": max((len(row) for row in rows), default=0),
                "hasMergedCells": merged,
            }
        )
        if merged:
            self.warnings.add(
                "UNSUPPORTED_STRUCTURE_FLATTENED",
                "表格合并单元格已在中间结构中标记",
            )
        for relationship_id, alt in image_references:
            self._append_image(relationship_id, alt)

    def _append_block(
        self,
        *,
        source_type: str,
        role: str,
        text: str,
        style_metadata: dict[str, object],
        relation_metadata: dict[str, object],
        allow_empty: bool = False,
    ) -> dict[str, object]:
        normalized = _normalized_text(text)
        if not normalized and not allow_empty:
            raise ValueError("empty source block")
        order_index = len(self.blocks)
        identity = str(relation_metadata.get("relationshipId") or relation_metadata.get("tableId") or "")
        block = {
            "sourceBlockId": _source_block_id(order_index, source_type, normalized, identity),
            "sourceType": source_type,
            "role": role,
            "text": normalized,
            "textHash": _sha256_text(normalized),
            "orderIndex": order_index,
            "styleMetadata": style_metadata,
            "relationMetadata": relation_metadata,
        }
        self.blocks.append(block)
        return block

    def _append_image(self, relationship_id: str, alt: str) -> None:
        self._image_occurrences += 1
        if self._image_occurrences > MAX_IMAGE_COUNT:
            raise DocxLimitError(
                "DOCX 图片数超过限制",
                details={"maximum": MAX_IMAGE_COUNT},
            )
        relationship = self.relationships.get(relationship_id)
        if relationship is None or not _relationship_is_image(relationship):
            self.warnings.add(
                "EXTERNAL_IMAGE_REFERENCE",
                "图片引用缺失或关系类型无效，已保留占位",
            )
            self._append_image_placeholder(relationship_id, alt, None)
            return
        if relationship.archive_path is None:
            self.warnings.add("EXTERNAL_IMAGE_REFERENCE", "外部图片未下载，已保留占位")
            safe_source = (
                relationship.target
                if re.match(r"^https?://[^\s]+$", relationship.target, re.IGNORECASE)
                else None
            )
            self._append_image_placeholder(relationship_id, alt, safe_source)
            return
        if not self.archive.has(relationship.archive_path):
            self.warnings.add("EXTERNAL_IMAGE_REFERENCE", "图片文件缺失，已保留占位")
            self._append_image_placeholder(relationship_id, alt, None)
            return

        resource = self._resource_by_path.get(relationship.archive_path)
        if resource is None:
            payload = self.archive.read(relationship.archive_path)
            declared_extension = PurePosixPath(relationship.archive_path).suffix.lower().lstrip(".")
            declared_mime = self.content_type_overrides.get(
                relationship.archive_path
            ) or self.content_type_defaults.get(declared_extension) or mimetypes.guess_type(
                relationship.archive_path
            )[0]
            detected = _detected_raster_type(payload)
            if detected is None:
                self.warnings.add(
                    "UNSUPPORTED_STRUCTURE_FLATTENED",
                    "非 PNG/JPEG/WebP/GIF 图片已保留为占位",
                )
                self._append_image_placeholder(relationship_id, alt, None)
                return
            mime_type, extension = detected
            if declared_mime is not None and declared_mime != mime_type:
                self.warnings.add(
                    "SECURITY_CONTENT_REMOVED",
                    "图片声明类型与实际内容不一致，已按实际类型提取",
                )
            resource_key = f"image_{len(self.resources) + 1:04d}"
            filename = PurePosixPath(relationship.archive_path).name
            resource = {
                "resourceKey": resource_key,
                "archivePath": relationship.archive_path,
                "originalFilename": filename,
                "mimeType": mime_type,
                "fileExtension": extension or None,
                "byteLength": len(payload),
                "sha256": _sha256_bytes(payload),
                "firstOrderIndex": len(self.blocks),
            }
            if self.extract_directory is not None:
                suffix = f".{extension}" if extension else ""
                destination = self.extract_directory / f"{resource_key}{suffix}"
                destination.write_bytes(payload)
                resource["extractedPath"] = str(destination)
            self.resources.append(resource)
            self._resource_by_path[relationship.archive_path] = resource
        resource["occurrenceCount"] = int(resource.get("occurrenceCount", 0)) + 1
        self._append_block(
            source_type="image",
            role="image_reference",
            text=alt,
            style_metadata={},
            relation_metadata={
                "relationshipId": relationship_id,
                "resourceKey": resource["resourceKey"],
                "alt": alt,
            },
            allow_empty=True,
        )

    def _append_image_placeholder(
        self,
        relationship_id: str,
        alt: str,
        source_url: str | None,
    ) -> None:
        relation: dict[str, object] = {"relationshipId": relationship_id, "alt": alt}
        if source_url is not None:
            relation["sourceUrl"] = source_url
        self._append_block(
            source_type="image",
            role="image_reference",
            text=alt,
            style_metadata={},
            relation_metadata=relation,
            allow_empty=True,
        )


def _detect_source(archive: SafeDocxArchive) -> str:
    part = "docProps/app.xml"
    if not archive.has(part):
        return "word"
    root = _parse_xml(archive.read(part, xml=True), part)
    application = " ".join(root.itertext()).lower()
    return "wps" if "wps" in application or "kingsoft" in application else "word"


def _statistics(blocks: list[dict[str, object]], warnings: WarningCollector) -> dict[str, int]:
    visible_text = "\n".join(str(block["text"]) for block in blocks if block["role"] != "image_reference")
    warning_values = warnings.values()

    def warning_count(code: str) -> int:
        return sum(int(entry["count"]) for entry in warning_values if entry["code"] == code)

    return {
        "wordCount": _count_words(visible_text),
        "characterCount": len(visible_text.replace("\n", "")),
        "blockCount": len(blocks),
        "headingCount": sum(1 for block in blocks if str(block["role"]).startswith("heading_")),
        "imageCount": sum(1 for block in blocks if block["role"] == "image_reference"),
        "tableCount": sum(1 for block in blocks if block["sourceType"] == "table"),
        "removedStyleCount": warning_count("STYLE_CLEANED"),
        "removedSecurityNodeCount": warning_count("SECURITY_CONTENT_REMOVED"),
        "removedHiddenNodeCount": warning_count("HIDDEN_CONTENT_REMOVED"),
        "removedUnsafeLinkCount": warning_count("UNSAFE_LINK_REMOVED"),
    }


def _document_json(blocks: list[dict[str, object]], detected_source: str) -> dict[str, object]:
    return {
        "schemaVersion": "1.0.0",
        "source": {"type": "docx", "detectedSource": detected_source},
        "content": [
            {
                "type": str(block["sourceType"]),
                "sourceBlockId": block["sourceBlockId"],
                "text": block["text"],
                "attrs": {
                    "role": block["role"],
                    **dict(block["relationMetadata"]),
                },
            }
            for block in blocks
        ],
    }


def parse_docx(
    path: str | Path,
    *,
    extract_directory: str | Path | None = None,
    retain_original_directory: str | Path | None = None,
) -> dict[str, object]:
    """Parse a standard Word/WPS DOCX into DOCX Intermediate v1.

    The source archive is never modified. Optional output directories only receive
    fixed, parser-generated filenames after the ZIP package passes validation.
    """

    source_path = Path(path)
    if source_path.suffix.lower() != ".docx":
        raise DocxParseError(
            "只支持 .docx 文件",
            details={"extension": source_path.suffix.lower()},
        )
    extract_path = Path(extract_directory) if extract_directory is not None else None
    retained_path = (
        Path(retain_original_directory) if retain_original_directory is not None else None
    )
    if extract_path is not None:
        extract_path.mkdir(parents=True, exist_ok=True)
    if retained_path is not None:
        retained_path.mkdir(parents=True, exist_ok=True)

    with SafeDocxArchive(source_path) as archive:
        _reject_active_content(archive)
        content_type_defaults, content_type_overrides = _parse_content_types(archive)
        relationships = _parse_relationships(archive, "word/document.xml")
        styles = _parse_styles(archive)
        numbering = _parse_numbering(archive)
        warnings = WarningCollector()
        builder = _DocumentBuilder(
            archive,
            relationships,
            styles,
            numbering,
            content_type_defaults,
            content_type_overrides,
            warnings,
            extract_path,
        )
        root = _parse_xml(archive.read("word/document.xml", xml=True), "word/document.xml")
        body = root.find(f"{W}body")
        if body is None:
            raise DocxParseError("DOCX 缺少文档正文")
        for child in body:
            if child.tag == f"{W}p":
                builder.add_paragraph(child)
            elif child.tag == f"{W}tbl":
                builder.add_table(child)
        if not builder.blocks:
            raise DocxParseError("DOCX 未识别到可导入内容")
        detected_source = _detect_source(archive)

    source_bytes = source_path.read_bytes()
    original: dict[str, object] = {
        "filename": source_path.name,
        "fileSize": len(source_bytes),
        "sha256": _sha256_bytes(source_bytes),
        "retained": retained_path is not None,
    }
    if retained_path is not None:
        destination = retained_path / "original.docx"
        shutil.copyfile(source_path, destination)
        original["retainedPath"] = str(destination)
    original_text = "\n".join(
        str(block["text"])
        for block in builder.blocks
        if block["role"] != "image_reference" and str(block["text"])
    )
    result = {
        "schemaVersion": SCHEMA_VERSION,
        "parserVersion": PARSER_VERSION,
        "detectedSource": detected_source,
        "documentSourceType": "docx",
        "title": _document_title_from_blocks(builder.blocks, source_path.stem),
        "original": original,
        "originalText": original_text,
        "originalTextHash": _sha256_text(original_text),
        "sourceBlocks": builder.blocks,
        "resources": builder.resources,
        "tables": builder.tables,
        "warnings": warnings.values(),
        "statistics": _statistics(builder.blocks, warnings),
        "documentJson": _document_json(builder.blocks, detected_source),
    }
    json.dumps(result, ensure_ascii=False)
    return result


def _document_title_from_blocks(blocks: list[dict[str, object]], filename_stem: str) -> str:
    title_block = next((block for block in blocks if block["role"] == "title" and block["text"]), None)
    if title_block is not None:
        return str(title_block["text"])[:255]
    first_heading = next(
        (block for block in blocks if str(block["role"]).startswith("heading_") and block["text"]),
        None,
    )
    if first_heading is not None:
        return str(first_heading["text"])[:255]
    normalized_filename = _normalized_text(filename_stem)
    if normalized_filename:
        return normalized_filename[:255]
    first_text = next((str(block["text"]) for block in blocks if block["text"]), "未命名导入")
    return first_text[:80]
