<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

function log_line(string $level, string $msg, array $ctx = []): void
{
    error_log(json_encode([
        'ts'    => date('c'),
        'level' => $level,
        'msg'   => $msg,
        'ctx'   => $ctx,
    ], JSON_UNESCAPED_SLASHES));
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        global $config;
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['db']['host'],
            $config['db']['port'],
            $config['db']['name']
        );
        $opts = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 3,   // 连接超时,避免 probe 卡死
        ];
        if (!empty($config['db']['ssl_ca'])) {
            $opts[PDO::MYSQL_ATTR_SSL_CA] = $config['db']['ssl_ca'];
        }
        $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], $opts);
    }
    return $pdo;
}

function redis(): Redis
{
    static $r = null;
    if ($r === null) {
        global $config;
        $r = new Redis();
        $r->connect($config['redis']['host'], $config['redis']['port'], 1.0);
        if (!empty($config['redis']['pass'])) {
            $r->auth($config['redis']['pass']);
        }
        if ($config['redis']['db'] > 0) {
            $r->select($config['redis']['db']);
        }
        $r->setOption(Redis::OPT_READ_TIMEOUT, 1.0);
    }
    return $r;
}