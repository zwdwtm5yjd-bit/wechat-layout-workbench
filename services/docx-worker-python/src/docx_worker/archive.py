"""Bounded, read-only access to an OOXML ZIP package."""

from __future__ import annotations

import re
import stat
from pathlib import Path
from zipfile import BadZipFile, ZipFile, ZipInfo

from .errors import DocxLimitError, DocxParseError, DocxSecurityError

MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024
MAX_ENTRY_BYTES = 64 * 1024 * 1024
MAX_XML_BYTES = 32 * 1024 * 1024
MAX_ENTRIES = 5_000
MAX_COMPRESSION_RATIO = 2_000

REQUIRED_PARTS = frozenset(
    {
        "[Content_Types].xml",
        "_rels/.rels",
        "word/document.xml",
    }
)


def _validate_member_name(name: str) -> None:
    candidate = name[:-1] if name.endswith("/") else name
    if not candidate:
        return
    if name.startswith(("/", "\\")) or "\\" in name:
        raise DocxSecurityError(
            "DOCX 包含非法 ZIP 路径",
            details={"entry": name, "reason": "absolute_or_backslash_path"},
        )
    parts = candidate.split("/")
    if any(part in {"", ".", ".."} for part in parts) or re.match(r"^[A-Za-z]:", parts[0]):
        raise DocxSecurityError(
            "DOCX 包含非法 ZIP 路径",
            details={"entry": name, "reason": "path_traversal"},
        )


def _validate_member(info: ZipInfo) -> None:
    _validate_member_name(info.filename)
    unix_mode = info.external_attr >> 16
    if unix_mode and stat.S_ISLNK(unix_mode):
        raise DocxSecurityError(
            "DOCX 包含不受支持的符号链接",
            details={"entry": info.filename},
        )
    if info.flag_bits & 0x1:
        raise DocxSecurityError(
            "DOCX 包含加密文件",
            details={"entry": info.filename},
        )
    if info.file_size > MAX_ENTRY_BYTES:
        raise DocxLimitError(
            "DOCX 内部单个文件过大",
            details={"entry": info.filename, "maximumBytes": MAX_ENTRY_BYTES},
        )
    if (
        info.file_size > 1024 * 1024
        and info.compress_size > 0
        and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO
    ):
        raise DocxSecurityError(
            "DOCX 包含异常压缩比文件",
            details={"entry": info.filename, "reason": "zip_bomb_ratio"},
        )


class SafeDocxArchive:
    """Validates ZIP metadata before exposing bounded member reads."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._zip: ZipFile | None = None
        self._members: dict[str, ZipInfo] = {}

    def __enter__(self) -> "SafeDocxArchive":
        if not self.path.is_file():
            raise DocxParseError("DOCX 文件不存在", details={"path": str(self.path)})
        archive_size = self.path.stat().st_size
        if archive_size > MAX_ARCHIVE_BYTES:
            raise DocxLimitError(
                "DOCX 文件超过 50MB 限制",
                details={"actualBytes": archive_size, "maximumBytes": MAX_ARCHIVE_BYTES},
            )
        try:
            self._zip = ZipFile(self.path, "r")
            infos = self._zip.infolist()
        except BadZipFile as error:
            raise DocxParseError("DOCX 不是有效的 ZIP/OOXML 文件") from error
        try:
            if len(infos) > MAX_ENTRIES:
                raise DocxLimitError(
                    "DOCX 内部文件数超过限制",
                    details={"actual": len(infos), "maximum": MAX_ENTRIES},
                )
            total_size = 0
            for info in infos:
                _validate_member(info)
                if info.filename in self._members:
                    raise DocxSecurityError(
                        "DOCX 包含重复路径",
                        details={"entry": info.filename},
                    )
                self._members[info.filename] = info
                total_size += info.file_size
                if total_size > MAX_UNCOMPRESSED_BYTES:
                    raise DocxLimitError(
                        "DOCX 解压后体积超过限制",
                        details={
                            "actualBytes": total_size,
                            "maximumBytes": MAX_UNCOMPRESSED_BYTES,
                        },
                    )
            missing = sorted(REQUIRED_PARTS.difference(self._members))
            if missing:
                raise DocxParseError(
                    "DOCX 缺少必需的 OOXML 部件",
                    details={"missingParts": missing},
                )
        except Exception:
            self.close()
            raise
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def close(self) -> None:
        if self._zip is not None:
            self._zip.close()
            self._zip = None

    @property
    def names(self) -> frozenset[str]:
        return frozenset(self._members)

    def has(self, name: str) -> bool:
        return name in self._members

    def info(self, name: str) -> ZipInfo:
        try:
            return self._members[name]
        except KeyError as error:
            raise DocxParseError("DOCX 引用了缺失部件", details={"part": name}) from error

    def read(self, name: str, *, xml: bool = False) -> bytes:
        if self._zip is None:
            raise RuntimeError("DOCX archive is closed")
        info = self.info(name)
        limit = MAX_XML_BYTES if xml else MAX_ENTRY_BYTES
        if info.file_size > limit:
            raise DocxLimitError(
                "DOCX 内部文件超过解析限制",
                details={"entry": name, "maximumBytes": limit},
            )
        try:
            with self._zip.open(info, "r") as stream:
                payload = stream.read(limit + 1)
        except (BadZipFile, RuntimeError) as error:
            raise DocxParseError("DOCX 内部文件损坏", details={"entry": name}) from error
        if len(payload) > limit:
            raise DocxLimitError(
                "DOCX 内部文件超过解析限制",
                details={"entry": name, "maximumBytes": limit},
            )
        return payload
