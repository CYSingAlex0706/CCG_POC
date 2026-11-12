<?php
declare(strict_types=1);

/**
 * 所有配置都来自环境变量 —— 同一个镜像可连任意 MySQL / Redis 端点,
 * 不需要为不同环境重新构建镜像。
 */

function require_env(string $name): string
{
    $v = getenv($name);
    if ($v === false || $v === '') {
        throw new RuntimeException("Missing required env var: $name");
    }
    return $v;
}

function opt_env(string $name, ?string $default = null): ?string
{
    $v = getenv($name);
    return ($v === false || $v === '') ? $default : $v;
}

return [
    'db' => [
        'host'   => require_env('DB_HOST'),          // 任意 endpoint
        'port'   => (int) opt_env('DB_PORT', '3306'),
        'name'   => require_env('DB_NAME'),
        'user'   => require_env('DB_USER'),
        'pass'   => require_env('DB_PASSWORD'),
        'ssl_ca' => opt_env('DB_SSL_CA'),            // 可选:RDS / Cloud SQL / Azure 需要
    ],
    'redis' => [
        'host' => opt_env('REDIS_HOST', '127.0.0.1'),
        'port' => (int) opt_env('REDIS_PORT', '6379'),
        'pass' => opt_env('REDIS_PASSWORD'),
        'db'   => (int) opt_env('REDIS_DB', '0'),
        'ttl'  => (int) opt_env('REDIS_TTL', '60'),
    ],
];