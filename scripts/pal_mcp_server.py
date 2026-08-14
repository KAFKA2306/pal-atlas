from __future__ import annotations

from typing import Any

import pal_mcp_read_model as read_model
from mcp.server import MCPServer

mcp = MCPServer(
    "PAL ATLAS",
    version="1.0.0",
    instructions=(
        "Read-only Palworld catalog and breeding MCP. Keep deterministic normal-formula results "
        "separate from source-reported special combinations and never infer source agreement."
    ),
)


@mcp.tool()
def search_pals(query: str | None = None, element: str | None = None, limit: int = 20) -> dict[str, Any]:
    """Search the generated canonical Pal catalog by ID/name and optional element."""
    return read_model.search_pals(query=query, element=element, limit=limit)


@mcp.tool()
def get_pal(pal_id: str) -> dict[str, Any]:
    """Get one canonical Pal with source-tier and artifact provenance."""
    return read_model.get_pal(pal_id)


@mcp.tool()
def breed(parent_a: str, parent_b: str) -> dict[str, Any]:
    """Return special-source and deterministic normal-formula results without conflating them."""
    return read_model.breed(parent_a, parent_b)


@mcp.tool()
def get_recipes(child_id: str, limit: int = 100) -> dict[str, Any]:
    """Return bounded parent recipes for one child, preserving result kind."""
    return read_model.get_recipes(child_id, limit=limit)


@mcp.tool()
def get_outputs(parent_id: str, limit: int = 100) -> dict[str, Any]:
    """Return bounded generated outputs for one parent from the shared children artifact."""
    return read_model.get_outputs(parent_id, limit=limit)


@mcp.tool()
def get_sources() -> dict[str, Any]:
    """Return the machine-readable source registry and repository-owned tier policy."""
    return read_model.get_sources()


@mcp.tool()
def get_conflicts(limit: int = 100) -> dict[str, Any]:
    """Return unresolved conflicts plus whether cross-source comparison is complete enough to judge agreement."""
    return read_model.get_conflicts(limit=limit)


@mcp.tool()
def get_data_health() -> dict[str, Any]:
    """Check catalog counts, ID/reference integrity, source tiers and conflict-evaluation status."""
    return read_model.get_data_health()


@mcp.tool()
def get_methodology() -> dict[str, Any]:
    """Return normal/special semantics, source/conflict policy and ontology artifact identity."""
    return read_model.get_methodology()


def main() -> None:
    mcp.run("streamable-http", host="127.0.0.1", port=8013)


if __name__ == "__main__":
    main()
