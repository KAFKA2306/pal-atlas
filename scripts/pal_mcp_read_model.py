from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MAX_LIMIT = 100


def _load(name: str) -> dict[str, Any]:
    path = DATA / name
    if not path.is_file():
        raise FileNotFoundError(f"generated_data_not_materialized:{name}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise TypeError(f"{name} must contain a JSON object")
    return payload


def _hash_json(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _freshness_seconds(timestamp: str | None) -> int | None:
    if not timestamp:
        return None
    try:
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return max(0, int((datetime.now(UTC) - parsed.astimezone(UTC)).total_seconds()))


def _validate_limit(limit: int) -> None:
    if not 1 <= limit <= MAX_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_LIMIT}")


def _dataset() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    return (
        _load("pals.json"),
        _load("breeding.json"),
        _load("children.json"),
        _load("sources.json"),
        _load("conflicts.json"),
    )


def _sources_by_id(source_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("id")): row for row in source_data.get("sources", []) if isinstance(row, dict) and row.get("id")
    }


def _provenance(
    *,
    meta: dict[str, Any],
    source_data: dict[str, Any],
    record: dict[str, Any],
    derivation_method: str,
    source_id: str = "palworld-gg",
    complete_source_hash: bool = False,
) -> dict[str, Any]:
    source = _sources_by_id(source_data).get(source_id, {})
    generated_at = meta.get("generatedAt")
    source_hash = meta.get("sourceHash")
    null_reason = None
    if not complete_source_hash:
        null_reason = "breeding_rank_and_source_combo_module_hash_not_materialized"
    return {
        "schema_version": "pal-atlas.provenance.v1",
        "data_as_of": generated_at,
        "generated_at": generated_at,
        "source_type": source.get("sourceType"),
        "source_tier": source.get("sourceTier"),
        "source_url": source.get("url"),
        "source_observed_at": source.get("observedAt") or source_data.get("generatedAt"),
        "source_hash": source_hash,
        "source_hash_scope": "palworld_gg_en_ja_html_pages_only" if source_hash else None,
        "record_hash": _hash_json(record),
        "derivation_method": derivation_method,
        "conflict_status": "unknown_not_fully_machine_compared",
        "freshness_seconds": _freshness_seconds(generated_at),
        "null_reason": null_reason,
    }


def search_pals(query: str | None = None, element: str | None = None, limit: int = 20) -> dict[str, Any]:
    _validate_limit(limit)
    pals_data, _, _, source_data, _ = _dataset()
    meta = pals_data.get("meta", {})
    rows = [row for row in pals_data.get("pals", []) if isinstance(row, dict)]
    if query:
        needle = query.casefold().strip()
        rows = [
            row
            for row in rows
            if needle in f"{row.get('id', '')} {row.get('nameEn', '')} {row.get('nameJa', '')}".casefold()
        ]
    if element:
        rows = [row for row in rows if element in (row.get("elements") or [])]
    rows = rows[:limit]
    return {
        "schema_version": "pal-atlas.search.v1",
        "count": len(rows),
        "items": [
            {
                **row,
                "canonical_id": row.get("id"),
                "provenance": _provenance(
                    meta=meta,
                    source_data=source_data,
                    record=row,
                    derivation_method="normalized Palworld.gg catalog record",
                ),
            }
            for row in rows
        ],
    }


def get_pal(pal_id: str) -> dict[str, Any]:
    pals_data, _, _, source_data, _ = _dataset()
    meta = pals_data.get("meta", {})
    row = next((row for row in pals_data.get("pals", []) if isinstance(row, dict) and row.get("id") == pal_id), None)
    if row is None:
        return {"schema_version": "pal-atlas.pal.v1", "found": False, "pal": None, "null_reason": "pal_not_found"}
    return {
        "schema_version": "pal-atlas.pal.v1",
        "found": True,
        "pal": {
            **row,
            "canonical_id": row.get("id"),
            "provenance": _provenance(
                meta=meta,
                source_data=source_data,
                record=row,
                derivation_method="normalized Palworld.gg catalog record",
            ),
        },
        "null_reason": None,
    }


def _pair_matches(row: dict[str, Any], parent_a: str, parent_b: str) -> bool:
    return {str(row.get("parentA")), str(row.get("parentB"))} == {parent_a, parent_b}


def _breed_result(
    row: dict[str, Any], *, kind: str, meta: dict[str, Any], source_data: dict[str, Any]
) -> dict[str, Any]:
    derivation = (
        "deterministic nearest-breeding-rank formula"
        if kind == "normal_formula"
        else "source-reported special combination"
    )
    return {
        **row,
        "result_kind": kind,
        "canonical_id": row.get("id"),
        "provenance": _provenance(
            meta=meta,
            source_data=source_data,
            record=row,
            derivation_method=derivation,
        ),
    }


def breed(parent_a: str, parent_b: str) -> dict[str, Any]:
    pals_data, breeding_data, _, source_data, conflict_data = _dataset()
    meta = pals_data.get("meta", {})
    pal_ids = {str(row.get("id")) for row in pals_data.get("pals", []) if isinstance(row, dict)}
    missing = [pal_id for pal_id in (parent_a, parent_b) if pal_id not in pal_ids]
    if missing:
        return {
            "schema_version": "pal-atlas.breed.v1",
            "available": False,
            "null_reason": "parent_not_found",
            "missing_parent_ids": missing,
            "results": [],
        }
    special = [
        _breed_result(row, kind="special_source", meta=meta, source_data=source_data)
        for row in breeding_data.get("special", [])
        if isinstance(row, dict) and _pair_matches(row, parent_a, parent_b)
    ]
    normal = [
        _breed_result(row, kind="normal_formula", meta=meta, source_data=source_data)
        for row in breeding_data.get("normal", [])
        if isinstance(row, dict) and _pair_matches(row, parent_a, parent_b)
    ]
    return {
        "schema_version": "pal-atlas.breed.v1",
        "available": True,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "special_results": special,
        "normal_results": normal,
        "results": special + normal,
        "normal_formula": meta.get("formula"),
        "special_overrides_normal_for_gameplay": bool(special),
        "conflict_evaluation_status": conflict_data.get("evaluationStatus"),
        "conflict_null_reason": conflict_data.get("nullReason"),
    }


def get_recipes(child_id: str, limit: int = 100) -> dict[str, Any]:
    _validate_limit(limit)
    pals_data, breeding_data, _, source_data, _ = _dataset()
    meta = pals_data.get("meta", {})
    special = [
        _breed_result(row, kind="special_source", meta=meta, source_data=source_data)
        for row in breeding_data.get("special", [])
        if isinstance(row, dict) and row.get("child") == child_id
    ]
    normal = [
        _breed_result(row, kind="normal_formula", meta=meta, source_data=source_data)
        for row in breeding_data.get("normal", [])
        if isinstance(row, dict) and row.get("child") == child_id
    ]
    rows = (special + normal)[:limit]
    return {"schema_version": "pal-atlas.recipes.v1", "child_id": child_id, "count": len(rows), "items": rows}


def get_outputs(parent_id: str, limit: int = 100) -> dict[str, Any]:
    _validate_limit(limit)
    pals_data, _, children_data, source_data, _ = _dataset()
    meta = pals_data.get("meta", {})
    rows = [row for row in children_data.get("outputs", {}).get(parent_id, []) if isinstance(row, dict)][:limit]
    items = []
    for row in rows:
        kind = "special_source" if row.get("kind") == "special" else "normal_formula"
        items.append(_breed_result(row, kind=kind, meta=meta, source_data=source_data))
    return {"schema_version": "pal-atlas.outputs.v1", "parent_id": parent_id, "count": len(items), "items": items}


def get_sources() -> dict[str, Any]:
    source_data = _load("sources.json")
    sources = [row for row in source_data.get("sources", []) if isinstance(row, dict)]
    return {
        "schema_version": source_data.get("schemaVersion", "pal-atlas.sources.v1"),
        "generated_at": source_data.get("generatedAt"),
        "tier_policy": source_data.get("tierPolicy"),
        "registry_hash": source_data.get("registryHash"),
        "count": len(sources),
        "items": sources,
    }


def get_conflicts(limit: int = 100) -> dict[str, Any]:
    _validate_limit(limit)
    payload = _load("conflicts.json")
    rows = [row for row in payload.get("conflicts", []) if isinstance(row, dict)][:limit]
    return {
        "schema_version": payload.get("schemaVersion", "pal-atlas.conflicts.v1"),
        "generated_at": payload.get("generatedAt"),
        "data_as_of": payload.get("dataAsOf"),
        "evaluation_status": payload.get("evaluationStatus"),
        "null_reason": payload.get("nullReason"),
        "policy": payload.get("policy"),
        "artifact_hash": payload.get("artifactHash"),
        "count": len(rows),
        "items": rows,
    }


def get_data_health() -> dict[str, Any]:
    pals_data, breeding_data, children_data, source_data, conflict_data = _dataset()
    pals = [row for row in pals_data.get("pals", []) if isinstance(row, dict)]
    pal_ids = {str(row.get("id")) for row in pals}
    reference_errors: list[str] = []
    for collection_name in ("normal", "special"):
        for row in breeding_data.get(collection_name, []):
            if not isinstance(row, dict):
                continue
            for field in ("parentA", "parentB", "child"):
                value = str(row.get(field))
                if value not in pal_ids:
                    reference_errors.append(f"{collection_name}:{row.get('id')}:{field}:{value}")
    output_parent_errors = [parent for parent in children_data.get("outputs", {}) if parent not in pal_ids]
    sources = [row for row in source_data.get("sources", []) if isinstance(row, dict)]
    tier_complete = all(row.get("sourceTier") in {1, 2, 3} and row.get("sourceType") for row in sources)
    return {
        "schema_version": "pal-atlas.data-health.v1",
        "generated_at": pals_data.get("meta", {}).get("generatedAt"),
        "catalog_count": len(pals),
        "normal_pair_count": len(breeding_data.get("normal", [])),
        "declared_normal_pair_count": breeding_data.get("normalCount"),
        "special_pair_count": len(breeding_data.get("special", [])),
        "unique_pal_ids": len(pal_ids) == len(pals),
        "reference_integrity_ok": not reference_errors and not output_parent_errors,
        "reference_errors": reference_errors[:20],
        "output_parent_errors": output_parent_errors[:20],
        "source_registry_count": len(sources),
        "source_tiers_complete": tier_complete,
        "conflict_evaluation_status": conflict_data.get("evaluationStatus"),
        "conflict_null_reason": conflict_data.get("nullReason"),
        "unresolved_conflict_count": len(conflict_data.get("conflicts", [])),
        "edinetdb_mode": "not_applicable",
    }


def get_methodology() -> dict[str, Any]:
    pals_data, _, _, source_data, conflict_data = _dataset()
    ontology_path = ROOT / "ontology" / "project.yaml"
    ontology_raw = ontology_path.read_bytes()
    return {
        "schema_version": "pal-atlas.methodology.v1",
        "normal_formula": pals_data.get("meta", {}).get("formula"),
        "normal_result_type": "CalculatedValue",
        "special_result_type": "ReportedFact",
        "special_normal_separation": True,
        "source_tier_policy": source_data.get("tierPolicy"),
        "conflict_policy": conflict_data.get("policy"),
        "conflict_evaluation_status": conflict_data.get("evaluationStatus"),
        "conflict_null_reason": conflict_data.get("nullReason"),
        "ontology_artifact": "ontology/project.yaml",
        "ontology_sha256": hashlib.sha256(ontology_raw).hexdigest(),
        "canonical_repository": "KAFKA2306/pal-atlas",
        "edinetdb_mode": "not_applicable",
    }
