"""Internal typed records for the DOCX parser."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Relationship:
    relationship_id: str
    relationship_type: str
    target: str
    target_mode: str
    archive_path: str | None


@dataclass(frozen=True)
class StyleDefinition:
    style_id: str
    name: str
    based_on: str | None
    outline_level: int | None


@dataclass(frozen=True)
class NumberingLevel:
    level: int
    number_format: str
    level_text: str
    start: int
    suffix: str


@dataclass(frozen=True)
class NumberingDefinition:
    number_id: str
    levels: dict[int, NumberingLevel]


@dataclass
class WarningCollector:
    _entries: dict[tuple[str, str], dict[str, object]] = field(default_factory=dict)

    def add(self, code: str, message: str, *, severity: str = "warning", count: int = 1) -> None:
        key = (code, message)
        current = self._entries.get(key)
        if current is None:
            self._entries[key] = {
                "code": code,
                "severity": severity,
                "message": message,
                "count": count,
            }
        else:
            current["count"] = int(current["count"]) + count

    def values(self) -> list[dict[str, object]]:
        return list(self._entries.values())
