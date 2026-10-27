<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$t0         = microtime(true);
$useCache   = !isset($_GET['nocache']);   // /index.php?nocache=1 -> force DB path
$cacheKey   = 'sale_documents:list';
$cacheHit   = false;
$docs       = null;

// ---- 1. try cache ------------------------------------------------------
if ($useCache) {
    try {
        $cached = redis()->get($cacheKey);
        if (is_string($cached)) {
            $decoded = json_decode($cached, true);
            if (is_array($decoded)) {
                $docs     = $decoded;
                $cacheHit = true;
            }
        }
    } catch (Throwable $e) {
        log_line('warning', 'redis_get_failed', ['key' => $cacheKey, 'error' => $e->getMessage()]);
    }
}

// ---- 2. fall back to the database --------------------------------------
if ($docs === null) {
    $dbStart = microtime(true);
    try {
        $stmt = db()->query(
            'SELECT id, reference, property_address, city, property_type, price,
                    sale_date, status, document_type, updated_at
               FROM sale_documents
           ORDER BY sale_date DESC'
        );
        $docs = $stmt->fetchAll();
    } catch (Throwable $e) {
        log_line('error', 'db_query_failed', ['query' => 'list_sale_documents', 'error' => $e->getMessage()]);
        http_response_code(500);
        echo 'Database error';
        exit;
    }

    log_line('info', 'db_query', [
        'query'       => 'list_sale_documents',
        'rows'        => count($docs),
        'duration_ms' => round((microtime(true) - $dbStart) * 1000, 2),
    ]);

    try {
        redis()->setex($cacheKey, $config['redis']['ttl'], json_encode($docs));
    } catch (Throwable $e) {
        log_line('warning', 'redis_set_failed', ['key' => $cacheKey, 'error' => $e->getMessage()]);
    }
}

// ---- 3. page-view counter in Redis ------------------------------------
$views = 0;
try {
    $views = (int) redis()->incr('pageviews:index');
} catch (Throwable $e) {
    log_line('warning', 'redis_incr_failed', ['error' => $e->getMessage()]);
}

$elapsed = round((microtime(true) - $t0) * 1000, 2);

log_line('info', 'http_request', [
    'path'        => '/index.php',
    'status'      => 200,
    'cache_hit'   => $cacheHit,
    'rows'        => count($docs),
    'duration_ms' => $elapsed,
]);
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Properties — Sale documents</title>
    <style>
        body  { font-family: system-ui, sans-serif; margin: 2rem; background:#f7f7f9; }
        h1    { margin-bottom: .25rem; }
        .meta { color:#666; font-size:.85rem; margin-bottom:1.5rem; }
        table { border-collapse: collapse; width:100%; background:#fff; }
        th, td{ padding:.55rem .75rem; border-bottom:1px solid #e5e5ea; text-align:left; font-size:.9rem; }
        th    { background:#f0f0f4; }
        tr:hover td { background:#fafafc; }
        .badge{ padding:.15rem .5rem; border-radius:999px; font-size:.75rem; color:#fff; }
        .completed{ background:#2e7d32; } .signed{ background:#1565c0; }
        .pending  { background:#ef6c00; } .draft{ background:#757575; }
        .cancelled{ background:#c62828; }
        a { color:#1565c0; text-decoration:none; }
    </style>
</head>
<body>
    <h1>Sale documents</h1>
    <p class="meta">
        <?= count($docs) ?> documents ·
        cache: <strong><?= $cacheHit ? 'HIT' : 'MISS' ?></strong> ·
        render: <?= $elapsed ?> ms ·
        page views: <?= $views ?> ·
        <a href="/index.php?nocache=1">force cache miss</a>
    </p>

    <table>
        <thead>
        <tr>
            <th>Reference</th><th>Property</th><th>City</th><th>Type</th>
            <th>Price</th><th>Sale date</th><th>Status</th><th>Document</th>
        </tr>
        </thead>
        <tbody>
        <?php foreach ($docs as $d): ?>
            <tr>
                <td><a href="/document.php?id=<?= (int) $d['id'] ?>"><?= htmlspecialchars($d['reference']) ?></a></td>
                <td><?= htmlspecialchars($d['property_address']) ?></td>
                <td><?= htmlspecialchars($d['city']) ?></td>
                <td><?= htmlspecialchars($d['property_type']) ?></td>
                <td><?= number_format((float) $d['price'], 0, ',', ' ') ?> €</td>
                <td><?= htmlspecialchars($d['sale_date']) ?></td>
                <td><span class="badge <?= htmlspecialchars($d['status']) ?>"><?= htmlspecialchars($d['status']) ?></span></td>
                <td><?= htmlspecialchars($d['document_type']) ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</body>
</html>