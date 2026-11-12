<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$t0 = microtime(true);
$id = (int) ($_GET['id'] ?? 0);

if ($id <= 0) {
    http_response_code(400);
    echo 'Missing or invalid id';
    exit;
}

$cacheKey = "sale_document:$id";
$doc      = null;
$cacheHit = false;

try {
    $cached = redis()->get($cacheKey);
    if (is_string($cached)) {
        $decoded = json_decode($cached, true);
        if (is_array($decoded)) {
            $doc      = $decoded;
            $cacheHit = true;
        }
    }
} catch (Throwable $e) {
    log_line('warning', 'redis_get_failed', ['key' => $cacheKey, 'error' => $e->getMessage()]);
}

if ($doc === null) {
    $dbStart = microtime(true);
    try {
        $stmt = db()->prepare(
            'SELECT id, reference, property_address, city, property_type, price,
                    sale_date, status, document_type, updated_at
               FROM sale_documents WHERE id = ?'
        );
        $stmt->execute([$id]);
        $doc = $stmt->fetch();
    } catch (Throwable $e) {
        log_line('error', 'db_query_failed', ['query' => 'get_sale_document', 'error' => $e->getMessage()]);
        http_response_code(500);
        echo 'Database error';
        exit;
    }

    log_line('info', 'db_query', [
        'query'       => 'get_sale_document',
        'id'          => $id,
        'found'       => (bool) $doc,
        'duration_ms' => round((microtime(true) - $dbStart) * 1000, 2),
    ]);

    if (!$doc) {
        log_line('info', 'http_request', ['path' => '/document.php', 'status' => 404, 'id' => $id]);
        http_response_code(404);
        echo 'Document not found';
        exit;
    }

    try {
        redis()->setex($cacheKey, $config['redis']['ttl'], json_encode($doc));
    } catch (Throwable $e) {
        log_line('warning', 'redis_set_failed', ['key' => $cacheKey, 'error' => $e->getMessage()]);
    }
}

$docViews = 0;
try {
    $docViews = (int) redis()->incr("views:doc:$id");
} catch (Throwable $e) {
    log_line('warning', 'redis_incr_failed', ['error' => $e->getMessage()]);
}

$elapsed = round((microtime(true) - $t0) * 1000, 2);

log_line('info', 'http_request', [
    'path'        => '/document.php',
    'status'      => 200,
    'id'          => $id,
    'cache_hit'   => $cacheHit,
    'duration_ms' => $elapsed,
]);
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?= htmlspecialchars($doc['reference']) ?></title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 2rem; background:#f7f7f9; }
        .card { background:#fff; padding:1.5rem 2rem; border-radius:8px; max-width:640px; }
        dt { color:#666; font-size:.8rem; margin-top:1rem; }
        dd { margin:.2rem 0 0; font-size:1rem; }
        .meta { color:#666; font-size:.85rem; margin-top:1.5rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1><?= htmlspecialchars($doc['reference']) ?></h1>

        <dl>
            <dt>Property</dt>       <dd><?= htmlspecialchars($doc['property_address']) ?></dd>
            <dt>City</dt>           <dd><?= htmlspecialchars($doc['city']) ?></dd>
            <dt>Type</dt>           <dd><?= htmlspecialchars($doc['property_type']) ?></dd>
            <dt>Price</dt>          <dd><?= number_format((float) $doc['price'], 0, ',', ' ') ?> €</dd>
            <dt>Sale date</dt>      <dd><?= htmlspecialchars($doc['sale_date']) ?></dd>
            <dt>Status</dt>         <dd><?= htmlspecialchars($doc['status']) ?></dd>
            <dt>Document type</dt>  <dd><?= htmlspecialchars($doc['document_type']) ?></dd>
            <dt>Last update</dt>    <dd><?= htmlspecialchars($doc['updated_at']) ?></dd>
        </dl>

        <p class="meta">
            cache: <strong><?= $cacheHit ? 'HIT' : 'MISS' ?></strong> ·
            render: <?= $elapsed ?> ms ·
            views for this document: <?= $docViews ?> ·
            <a href="/index.php">&larr; back to list</a>
        </p>
    </div>
</body>
</html>