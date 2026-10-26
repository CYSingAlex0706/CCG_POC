<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$result = [
    'status' => 'ok',
    'checks' => [
        'db'    => ['up' => false, 'latency_ms' => null, 'error' => null],
        'redis' => ['up' => false, 'latency_ms' => null, 'error' => null],
    ],
];

$start = microtime(true);
try {
    db()->query('SELECT 1');
    $result['checks']['db']['up'] = true;
} catch (Throwable $e) {
    $result['checks']['db']['error'] = $e->getMessage();
}
$result['checks']['db']['latency_ms'] = round((microtime(true) - $start) * 1000, 2);

$start = microtime(true);
try {
    $pong = redis()->ping();
    if ($pong === true || $pong === '+PONG') {
        $result['checks']['redis']['up'] = true;
    } else {
        $result['checks']['redis']['error'] = 'unexpected ping reply: ' . var_export($pong, true);
    }
} catch (Throwable $e) {
    $result['checks']['redis']['error'] = $e->getMessage();
}
$result['checks']['redis']['latency_ms'] = round((microtime(true) - $start) * 1000, 2);

$healthy = $result['checks']['db']['up'] && $result['checks']['redis']['up'];
if (!$healthy) {
    $result['status'] = 'degraded';
    http_response_code(503);
    log_line('error', 'healthcheck_failed', $result['checks']);
}

header('Content-Type: application/json');
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);