from __future__ import annotations

import asyncio
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import pal_mcp_read_model as read_model  # noqa: E402
import pal_mcp_server as server  # noqa: E402


def load_data(name: str) -> dict:
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def load_public(name: str) -> dict:
    return json.loads((ROOT / "public" / "api" / name).read_text(encoding="utf-8"))


def load_csv(name: str) -> list[dict[str, str]]:
    with (ROOT / "neo4j" / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def test_mcp_tool_catalog_is_discoverable() -> None:
    tools = asyncio.run(server.mcp.list_tools())
    assert {tool.name for tool in tools} == {
        "search_pals",
        "get_pal",
        "breed",
        "get_recipes",
        "get_outputs",
        "get_sources",
        "get_conflicts",
        "get_data_health",
        "get_methodology",
    }


def test_pal_record_matches_generated_and_static_api() -> None:
    pals_data = load_data("pals.json")
    first = pals_data["pals"][0]
    result = read_model.get_pal(first["id"])
    static = load_public(f"pals/{first['id']}.json")
    assert result["found"] is True
    mcp_pal = dict(result["pal"])
    provenance = mcp_pal.pop("provenance")
    mcp_pal.pop("canonical_id")
    assert mcp_pal == first
    assert static["pal"]["id"] == first["id"]
    assert static["pal"]["breedingRank"] == first["breedingRank"]
    assert provenance["source_tier"] == 2
    assert provenance["source_hash_scope"] == "palworld_gg_en_ja_html_pages_only"
    assert provenance["null_reason"] == "breeding_rank_and_source_combo_module_hash_not_materialized"


def test_normal_breed_replays_precomputed_domain_result() -> None:
    breeding = load_data("breeding.json")
    row = breeding["normal"][0]
    result = read_model.breed(row["parentA"], row["parentB"])
    matches = [item for item in result["normal_results"] if item["id"] == row["id"]]
    assert len(matches) == 1
    projected = dict(matches[0])
    projected.pop("provenance")
    projected.pop("result_kind")
    projected.pop("canonical_id")
    assert projected == row
    assert matches[0]["result_kind"] == "normal_formula"
    assert matches[0]["provenance"]["derivation_method"] == "deterministic nearest-breeding-rank formula"


def test_special_breed_is_never_labeled_normal() -> None:
    breeding = load_data("breeding.json")
    row = breeding["special"][0]
    result = read_model.breed(row["parentA"], row["parentB"])
    matches = [item for item in result["special_results"] if item["id"] == row["id"]]
    assert len(matches) == 1
    assert matches[0]["result_kind"] == "special_source"
    assert matches[0]["provenance"]["derivation_method"] == "source-reported special combination"
    assert all(item["result_kind"] == "normal_formula" for item in result["normal_results"])


def test_recipes_and_outputs_use_generated_indexes() -> None:
    breeding = load_data("breeding.json")
    children = load_data("children.json")
    normal = breeding["normal"][0]
    recipes = read_model.get_recipes(normal["child"], limit=100)
    assert any(item["id"] == normal["id"] for item in recipes["items"])

    parent = normal["parentA"]
    outputs = read_model.get_outputs(parent, limit=100)
    expected_ids = {row["id"] for row in children["outputs"][parent][:100]}
    assert {row["id"] for row in outputs["items"]} == expected_ids


def test_source_registry_has_explicit_tiers_and_static_parity() -> None:
    sources = read_model.get_sources()
    public_sources = load_public("sources.json")
    assert sources["items"] == public_sources["sources"]
    assert sources["registry_hash"] == public_sources["registryHash"]
    assert {row["sourceTier"] for row in sources["items"]} <= {1, 2, 3}
    assert all(row["sourceType"] for row in sources["items"])
    official = {row["id"] for row in sources["items"] if row["sourceTier"] == 1}
    assert official == {"official-news", "official-game", "official-docs"}


def test_conflict_state_is_fail_close_not_false_agreement() -> None:
    conflicts = read_model.get_conflicts()
    public_conflicts = load_public("conflicts.json")
    assert conflicts["evaluation_status"] == "partial"
    assert conflicts["null_reason"] == "registered_cross_check_sources_are_not_all_machine_ingested_as_field_level_claims"
    assert public_conflicts["evaluationStatus"] == "partial"
    assert public_conflicts["nullReason"] == conflicts["null_reason"]


def test_data_health_proves_reference_and_source_contracts() -> None:
    health = read_model.get_data_health()
    assert health["catalog_count"] >= 250
    assert health["normal_pair_count"] == health["declared_normal_pair_count"]
    assert health["unique_pal_ids"] is True
    assert health["reference_integrity_ok"] is True
    assert health["source_tiers_complete"] is True
    assert health["conflict_evaluation_status"] == "partial"
    assert health["edinetdb_mode"] == "not_applicable"


def test_methodology_preserves_normal_special_boundary() -> None:
    methodology = read_model.get_methodology()
    assert methodology["normal_result_type"] == "CalculatedValue"
    assert methodology["special_result_type"] == "ReportedFact"
    assert methodology["special_normal_separation"] is True
    assert methodology["conflict_evaluation_status"] == "partial"
    assert methodology["edinetdb_mode"] == "not_applicable"
    assert len(methodology["ontology_sha256"]) == 64


def test_neo4j_import_artifacts_match_canonical_pal_and_breeding_data() -> None:
    pals = load_data("pals.json")["pals"]
    breeding = load_data("breeding.json")
    neo4j_pals = load_csv("pals.csv")
    neo4j_normal = load_csv("breeding_edges.csv")
    neo4j_special = load_csv("special_edges.csv")

    assert {row["id"] for row in neo4j_pals} == {row["id"] for row in pals}
    assert {row["id"] for row in neo4j_normal} == {row["id"] for row in breeding["normal"]}
    assert {row["id"] for row in neo4j_special} == {row["id"] for row in breeding["special"]}

    pal_ids = {row["id"] for row in pals}
    for row in neo4j_normal:
        assert row["parentA"] in pal_ids
        assert row["parentB"] in pal_ids
        assert row["child"] in pal_ids
        assert row["rule"] == "nearest-breeding-rank"
    for row in neo4j_special:
        if row["status"] == "resolved":
            assert row["parentA"] in pal_ids
            assert row["parentB"] in pal_ids
            assert row["child"] in pal_ids

    import_cypher = (ROOT / "neo4j" / "import.cypher").read_text(encoding="utf-8")
    assert "LOAD CSV WITH HEADERS FROM 'file:///pals.csv'" in import_cypher
    assert "LOAD CSV WITH HEADERS FROM 'file:///breeding_edges.csv'" in import_cypher
    assert "LOAD CSV WITH HEADERS FROM 'file:///special_edges.csv'" in import_cypher
    assert "BreedingPair" in import_cypher
    assert "special" in import_cypher.lower()
