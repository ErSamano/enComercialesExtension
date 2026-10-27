<?php
declare(strict_types=1);

/** Production repository for the existing ec_raw_reportdata table. */
final class DatabaseRepository
{
    public function __construct(private mysqli $db) { $this->db->set_charset('utf8mb4'); }

    public function search(string $name, string $sku = '', string $gtin = '', int $limit = 5): array
    {
        $limit = min(max($limit, 1), 20);
        $tokens = preg_split('/\s+/', self::normalize($name), -1, PREG_SPLIT_NO_EMPTY);
        usort($tokens, static fn(string $a, string $b): int => strlen($b) <=> strlen($a));
        $needle = $tokens[0] ?? $name;
        $term = '%' . strtr($needle, ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']) . '%';
        $sql = "SELECT pname, MAX(plink) AS plink, MAX(store) AS store, MAX(ptype) AS ptype FROM ec_raw_reportdata WHERE pname LIKE ? ESCAPE '\\\\' AND price > 0 GROUP BY pname ORDER BY MAX(date) DESC LIMIT ?";
        $stmt = $this->db->prepare($sql); if (!$stmt) throw new RuntimeException('database query unavailable');
        $stmt->bind_param('si', $term, $limit); if (!$stmt->execute()) throw new RuntimeException('database query unavailable');
        $result = $stmt->get_result(); $rows = [];
        while ($row = $result->fetch_assoc()) {
            $confidence = self::matchConfidence($name, $row['pname']);
            $rows[] = ['id' => self::encodeId($row['pname']), 'name' => $row['pname'], 'url' => $row['plink'], 'retailer' => $row['store'], 'type' => $row['ptype'], 'matchConfidence' => $confidence, 'matchMethod' => $confidence === 'EXACT' ? 'normalized-name' : 'candidate-name'];
        }
        $stmt->close(); return $rows;
    }

    public function intelligence(string $productName): array
    {
        $sql = "SELECT COUNT(*) AS observations, MIN(price) AS low, MAX(price) AS high, AVG(price) AS average,
                    AVG(CASE WHEN date >= CURDATE() - INTERVAL 30 DAY THEN price END) AS average30d,
                    AVG(CASE WHEN date >= CURDATE() - INTERVAL 90 DAY THEN price END) AS average90d,
                    AVG(CASE WHEN date >= CURDATE() - INTERVAL 1 YEAR THEN price END) AS average1y,
                    MAX(date) AS lastUpdated
                FROM ec_raw_reportdata WHERE pname = ? AND price > 0";
        $stmt = $this->db->prepare($sql); if (!$stmt) throw new RuntimeException('database query unavailable'); $stmt->bind_param('s', $productName); $stmt->execute(); $stats = $stmt->get_result()->fetch_assoc() ?: []; $stmt->close();
        $lowStmt = $this->db->prepare("SELECT store, date FROM ec_raw_reportdata WHERE pname = ? AND price = (SELECT MIN(price) FROM ec_raw_reportdata WHERE pname = ? AND price > 0) AND price > 0 ORDER BY date ASC LIMIT 1");
        if (!$lowStmt) throw new RuntimeException('database query unavailable'); $lowStmt->bind_param('ss', $productName, $productName); $lowStmt->execute(); $low = $lowStmt->get_result()->fetch_assoc() ?: []; $lowStmt->close();
        $historyStmt = $this->db->prepare("SELECT date, price, sale, store, plink FROM ec_raw_reportdata WHERE pname = ? AND price > 0 ORDER BY date DESC LIMIT 1000");
        if (!$historyStmt) throw new RuntimeException('database query unavailable'); $historyStmt->bind_param('s', $productName); $historyStmt->execute(); $res = $historyStmt->get_result(); $history = []; $stores = [];
        while ($row = $res->fetch_assoc()) { $history[] = ['date' => $row['date'], 'price' => (float)$row['price'], 'salePrice' => $row['sale'] === null ? null : (float)$row['sale'], 'store' => $row['store']]; if (!isset($stores[$row['store']])) $stores[$row['store']] = ['store' => $row['store'], 'price' => (float)$row['price'], 'date' => $row['date'], 'url' => $row['plink']]; }
        $historyStmt->close(); usort($history, static fn(array $a, array $b): int => strcmp((string)$a['date'], (string)$b['date']));
        foreach ($stats as $key => $value) if ($key !== 'lastUpdated') $stats[$key] = $value === null ? null : (float)$value;
        $stats['lastUpdated'] = $stats['lastUpdated'] ?? null; $stats['bestStore'] = $low['store'] ?? null; $stats['dateOfLow'] = $low['date'] ?? null;
        $stats['historicalLow'] = $stats['low']; $stats['historicalHigh'] = $stats['high']; $stats['historicalAverage'] = $stats['average'];
        $current = $history[count($history) - 1] ?? null;
        $stats['salePercentage'] = $current && $current['salePrice'] !== null && $current['salePrice'] > $current['price'] ? round((($current['salePrice'] - $current['price']) / $current['salePrice']) * 100, 2) : null;
        return ['current' => $current, 'statistics' => $stats, 'history' => $history, 'stores' => array_values($stores)];
    }

    public static function encodeId(string $name): string { return rtrim(strtr(base64_encode($name), '+/', '-_'), '='); }
    public static function decodeId(string $id): ?string { $decoded = base64_decode(strtr($id, '-_', '+/'), true); return $decoded === false || $decoded === '' ? null : $decoded; }
    public static function rating(array $stats, ?array $current): ?array {
        if (!$current || ($stats['observations'] ?? 0) < 3 || $stats['average'] === null) return ['category' => 'INSUFFICIENT DATA', 'reason' => 'Fewer than three trusted observations are available.'];
        $price = (float)$current['price']; $average = (float)$stats['average']; $delta = ($price - $average) / $average;
        if ($stats['low'] !== null && $price <= ((float)$stats['low'] * 1.02)) return ['category' => 'GREAT DEAL', 'reason' => 'Current price is within 2% of the historical low.'];
        if ($delta <= -.10) return ['category' => 'GREAT DEAL', 'reason' => sprintf('Current price is %.1f%% below the historical average.', abs($delta * 100))];
        if ($delta <= -.03) return ['category' => 'GOOD DEAL', 'reason' => sprintf('Current price is %.1f%% below the historical average.', abs($delta * 100))];
        if ($delta <= .10) return ['category' => 'NORMAL PRICE', 'reason' => 'Current price is within the normal range around the historical average.'];
        return ['category' => 'EXPENSIVE', 'reason' => sprintf('Current price is %.1f%% above the historical average.', $delta * 100)];
    }
    private static function normalize(string $value): string { $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value; return trim((string)preg_replace('/[^a-z0-9]+/i', ' ', strtolower($value))); }
    public static function matchConfidence(string $left, string $right): string {
        if (self::normalize($left) === self::normalize($right)) return 'EXACT';
        preg_match_all('/\b(19|20)\d{2}\b/', $left, $leftYears); preg_match_all('/\b(19|20)\d{2}\b/', $right, $rightYears);
        if ($leftYears[0] && $rightYears[0] && array_diff($leftYears[0], $rightYears[0])) return 'LOW';
        preg_match_all('/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i', $left, $leftSizes); preg_match_all('/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i', $right, $rightSizes);
        $leftSize = $leftSizes[1][0] ?? null; $rightSize = $rightSizes[1][0] ?? null; $leftUnit = strtolower($leftSizes[2][0] ?? ''); $rightUnit = strtolower($rightSizes[2][0] ?? '');
        if ($leftSize !== null && $rightSize !== null && ($leftSize !== $rightSize || $leftUnit !== $rightUnit)) return 'LOW';
        preg_match_all('/\b(\d+)\s*x\s*\d+(?:[.,]\d+)?\s*(?:ml|cl|l)?\b/i', $left, $leftPacks); preg_match_all('/\b(\d+)\s*x\s*\d+(?:[.,]\d+)?\s*(?:ml|cl|l)?\b/i', $right, $rightPacks);
        if (($leftPacks[1][0] ?? null) !== null && ($rightPacks[1][0] ?? null) !== null && $leftPacks[1][0] !== $rightPacks[1][0]) return 'LOW';
        $leftTokens = array_unique(explode(' ', self::normalize($left))); $rightTokens = array_unique(explode(' ', self::normalize($right))); $overlap = count(array_intersect($leftTokens, $rightTokens)) / max(count($leftTokens), count($rightTokens), 1);
        return $overlap >= .85 ? 'HIGH' : ($overlap >= .6 ? 'MEDIUM' : 'LOW');
    }
}
