# Connectors

`connectors/base.py` defines `SourceChunk` and `BaseConnector`; `connectors/postmortem.py` implements it for local markdown postmortems and ADRs (`memory/corpus/{postmortems,adrs}/*.md`), parsing an `Author:`/`Date:` header. Depends on `schemas/source_chunk.schema.json`. Breaks if a corpus file drops its `Author:`/`Date:` header (silently falls back to `"unknown"` / epoch rather than failing loud) or if a filename is reused across `postmortems/` and `adrs/`, producing a duplicate chunk id.

GitHub and Slack connectors are not started (I2 remainder).
