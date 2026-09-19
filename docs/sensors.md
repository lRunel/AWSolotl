# Sensors -- injection scanner

I0 stub only: `injection_scan` always returns `False` (clean). Used by ingest (`memory/**`, I2) and by Person A's Gate 5 watchdog to flag text addressing the agent directly. Breaks if callers ever treat a flagged result as an instruction rather than data to log and continue past.
