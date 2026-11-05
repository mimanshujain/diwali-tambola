# Security and privacy

This project is designed for a trusted local network, **not direct exposure to the public internet**.

- Do not configure router port forwarding to the API.
- Keep the `.env` file and admin token out of Git, screenshots and logs.
- Use unique credentials and restrict access to the admin screen.
- Treat mobile numbers as personal data; avoid unnecessary exports or display on the TV.
- Do not assume phone numbers are verified: registration uniqueness is not SMS identity verification.
- Apply OS, Docker and application dependency updates between events.
- Review authenticated endpoints and rate limits before expanding access beyond a private LAN.
- Browser-based ticket printing may expose names or numbers in local print history; use trusted devices.

The LAN currently uses HTTP. If remote or untrusted-network access becomes necessary, add HTTPS, authentication hardening and network isolation first.
