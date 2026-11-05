# M7 B/C/D release candidate

This additive release includes LAN security response headers, a bounded admin-route request limiter, TV celebrations with opt-in synthesized chimes, fullscreen control, browser batch-printing of submitted tickets, and an isolated 30-player rehearsal.

It DOES NOT configure or perform unattended CUPS/network-printer output; the operator must use the browser's print dialog. This avoids bypassing the OS print queue and avoids sending tickets to an unverified physical printer.

The existing M7-A live Socket.IO test checks 50 concurrent watchers (`M7_TEST_CLIENTS=50`). The separate Python rehearsal creates thirty disposable submitted players and calls five numbers, then verifies a durable state snapshot. Any Pi restart recovery check should be performed when no real game is active. The release script runs that optional check against the isolated game when `M7_RESTART_TEST=1` is set.

Operational limitations: admin key is still a shared secret, not individual accounts; all pages are served over HTTP on the trusted LAN. Do not port-forward the Pi or use it over public Wi-Fi. M7 admin throttling is process-local; it is not an external rate-limit or TLS substitute. Sound requires a user click. The 30 test players and their game are retained for audit, not deleted.

Review visual behavior on TV, accessibility, and printer paper layout before merging.
