<?php
declare(strict_types=1);
require_once __DIR__ . '/repository.php';

header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? ''; $allowed = array_filter(array_map('trim', explode(',', getenv('EC_EXTENSION_ORIGINS') ?: '')));
if ($origin !== '' && in_array($origin, $allowed, true)) { header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); }
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); header('Access-Control-Allow-Headers: Content-Type'); http_response_code(204); exit; }
function respond(array $value, int $status = 200): void { http_response_code($status); echo json_encode($value, JSON_UNESCAPED_UNICODE); exit; }
function db(): DatabaseRepository {
    $root = getenv('EC_PUBLIC_HTML'); if (!$root) throw new RuntimeException('API database is not configured');
    $connect = rtrim($root, DIRECTORY_SEPARATOR) . '/scripts/connect.php'; if (!is_file($connect)) throw new RuntimeException('API database is not configured');
    require_once $connect; $connection = ec_db_connect(); if (!$connection) throw new RuntimeException('API database unavailable'); return new DatabaseRepository($connection);
}
try {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if ($path === '/health') { db(); respond(['status' => 'ok', 'apiVersion' => '1.1', 'database' => 'available']); }
    if ($path === '/api/prices/observe' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        if (getenv('EC_ENABLE_BROWSER_OBSERVATIONS') !== '1') respond(['error' => 'OBSERVATIONS_DISABLED'], 503);
        $payload = json_decode((string)file_get_contents('php://input'), true); $required = ['name', 'retailer', 'url', 'price', 'currency', 'extractionMethod', 'matchConfidence'];
        $retailerHosts = ['vinoteca.com', 'bodegasalianza.com', 'laeuropea.com.mx', 'elpalaciodehierro.com', 'lacastellana.com', 'liverpool.com.mx']; $host = strtolower((string)(parse_url((string)($payload['url'] ?? ''), PHP_URL_HOST) ?: '')); $validHost = false; foreach ($retailerHosts as $allowedHost) if ($host === $allowedHost || str_ends_with($host, '.' . $allowedHost)) $validHost = true;
        if (!is_array($payload) || count(array_diff($required, array_keys($payload))) || !filter_var($payload['url'] ?? '', FILTER_VALIDATE_URL) || parse_url($payload['url'], PHP_URL_SCHEME) !== 'https' || !$validHost || !is_numeric($payload['price']) || (float)$payload['price'] <= 0) respond(['error' => 'INVALID_OBSERVATION'], 400);
        $payload['source'] = 'BROWSER_EXTENSION'; $payload['observedAt'] = gmdate('c'); $file = getenv('EC_BROWSER_OBSERVATIONS_PATH'); if (!$file) respond(['error' => 'OBSERVATIONS_NOT_CONFIGURED'], 503); $dir = dirname($file); if (!is_dir($dir)) mkdir($dir, 0750, true); if (file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX) === false) respond(['error' => 'OBSERVATION_UNAVAILABLE'], 503); respond(['accepted' => true, 'source' => 'BROWSER_EXTENSION'], 202);
    }
    $repo = db();
    if ($path === '/api/products/search') { $name = trim((string)($_GET['name'] ?? '')); if ($name === '' || strlen($name) > 200) respond(['error' => 'INVALID_QUERY'], 400); $rows = $repo->search($name, (string)($_GET['sku'] ?? ''), (string)($_GET['gtin'] ?? ''), (int)($_GET['limit'] ?? 5)); respond(['products' => $rows]); }
    if ($path === '/api/products/compare') { $name = trim((string)($_GET['name'] ?? '')); if ($name === '' || strlen($name) > 200) respond(['error' => 'INVALID_QUERY'], 400); $rows = $repo->search($name, (string)($_GET['sku'] ?? ''), (string)($_GET['gtin'] ?? ''), (int)($_GET['limit'] ?? 20)); respond(['products' => $rows]); }
    if ($path === '/api/products/history') { $name = DatabaseRepository::decodeId((string)($_GET['id'] ?? '')); if ($name === null) respond(['error' => 'INVALID_PRODUCT'], 400); $confidence = strtoupper((string)($_GET['confidence'] ?? 'UNKNOWN')); if (!in_array($confidence, ['EXACT', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'], true)) $confidence = 'UNKNOWN'; $data = $repo->intelligence($name); respond(['product' => ['name' => $name], 'match' => ['confidence' => $confidence, 'method' => 'database-name', 'reason' => $confidence === 'LOW' || $confidence === 'UNKNOWN' ? 'Candidate is not a confirmed identity; treat history cautiously.' : 'History is keyed to the selected database product name.'], 'current' => $data['current'], 'statistics' => $data['statistics'], 'rating' => DatabaseRepository::rating($data['statistics'], $data['current']), 'history' => $data['history'], 'stores' => $data['stores']]); }
    respond(['error' => 'NOT_FOUND'], 404);
} catch (Throwable $error) { error_log('enComerciales extension API: ' . $error->getMessage()); respond(['error' => 'SERVICE_UNAVAILABLE'], 503); }
