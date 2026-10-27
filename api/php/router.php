<?php
// Development router for PHP's built-in server. Production should use the web server's PHP routing.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($path === '/health' || str_starts_with($path, '/api/')) { require __DIR__ . '/index.php'; return; }
return false;
