# Production deployment

Deploy `api/php/index.php` and `api/php/repository.php` alongside the existing PHP application, preferably behind the same HTTPS virtual host. Set `EC_PUBLIC_HTML` to the existing `public_html` directory and retain the site's normal `config/ec_config.php` environment-variable or local-config mechanism. Never commit the local configuration file or credentials.

Set `EC_EXTENSION_ORIGINS` to the exact published extension origin(s), for example the Chrome extension origin. Do not use `*` for production. Allow `GET` health/search/history and `OPTIONS` only as needed. Observation writes are disabled unless `EC_ENABLE_BROWSER_OBSERVATIONS=1` is explicitly set after an authenticated review workflow exists.

Use a least-privilege MariaDB user with read access to `ec_raw_reportdata` for this API. The repository uses prepared statements and performs aggregates in MariaDB. Add indexes on `(pname, price, date)` and `(pname, store, date)` only after reviewing the production query plan; this phase makes no schema changes.

Terminate TLS at the existing web server, route `/health` and `/api/products/*` to the PHP entry point, and keep PHP error logs server-side. Monitor 4xx/5xx rates and database latency without logging credentials, SQL text, or page contents. Configure the extension's production HTTPS URL in Options and update manifest host permissions before packaging.
