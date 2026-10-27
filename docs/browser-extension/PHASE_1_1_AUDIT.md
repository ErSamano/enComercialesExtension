# Phase 1.1 audit (historical)

This document records an earlier development phase. Its descriptions of the CSV-backed Python development API and localhost permissions are archival; that API and its tests have been removed from the current project. Follow the root README for current installation instructions and `docs/browser-extension/PRODUCTION_DEPLOYMENT.md` for the hosted PHP integration.

The historical audit examined product matching between the browser extension, scraper records, and the existing PHP/MariaDB application. The production integration uses the existing application connection and prepared SQL queries. The public browser extension contains no database credentials; it requests product matches and history from the hosted HTTPS service.
