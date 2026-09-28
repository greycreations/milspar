# ADR 0005: Standalone Compose release

Status: accepted, 2026-09-28.

Users must be able to install with Docker Compose and one downloaded file. Source builds and a separate .env created avoidable installation failures.

Publish web and API images to GHCR from GitHub Actions. Reuse the exact API image for migrations. Generate a Compose file with versioned application images and immutable digests for every image, including PostgreSQL. Keep editable installation settings inline and publish only the web port (3080 by default).

A separate runner must pull anonymously with an empty Docker configuration and start from a directory containing only Compose. Verify browser flows, persistence, a changed port and adoption of the original schema before publishing the prerelease and its installation instructions/checksums. Subsequent releases must also test upgrade from the previous released version.

The initial supported platform is Linux amd64. Authentication remains outside this release, so deployments are private test installations. Keep the Compose project name, existing database credentials and volumes during upgrades; back up before migration.

The repository root Compose file mirrors a published release. Source development and ordinary CI use docker-compose.dev.yml. A release does not imply that PR #2 has been merged.
