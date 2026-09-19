# Sensors -- injection scanner

`injection_scan` checks ingested text against a heuristic phrase list (imperative overrides like "ignore instructions", "grant admin access"); `wrap_untrusted` delimiter-wraps and length-caps text before it nears a prompt. Used by ingest (`memory/**`) and Person A's Gate 5 watchdog. Breaks if a caller ever treats a flagged result as an instruction to follow rather than a tag to store (`injection_flag`) and continue past -- flagging never blocks storage or grants anything.
