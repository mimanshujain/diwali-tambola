# Security and privacy

This project is designed for a trusted local network, **not direct exposure to the public internet**.

- Do not configure router port forwarding to the API.
- Keep the `.env` file and admin token out of Git, screenshots and logs.
- Generate a long random admin token with `openssl rand -hex 32`, place it in `.env`, and restrict the file with `chmod 600 .env`. Recreate the API container for a changed token to take effect; the currently running container keeps its old token until then.
- Use unique credentials and restrict access to the admin screen.
- Treat mobile numbers as personal data; avoid unnecessary exports or display on the TV.
- Do not assume phone numbers are verified: registration uniqueness is not SMS identity verification.
- Apply OS, Docker and application dependency updates between events.
- Invalid admin credentials are rate-limited per source IP on all admin-header requests and protected control routes. Valid host credentials remain usable during a limit. This in-memory, single-process guard is not distributed protection.
- Browser-based ticket printing may expose names or numbers in local print history; use trusted devices.

The LAN currently uses HTTP. If remote or untrusted-network access becomes necessary, add HTTPS, authentication hardening and network isolation first.
