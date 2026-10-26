<?php
return [
    'db' => [
        'host' => getenv('DB_HOST') ?: 'db',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'name' => getenv('DB_NAME') ?: 'properties',
        'user' => getenv('DB_USER') ?: 'app',
        'pass' => getenv('DB_PASS') ?: 'appsecret',
    ],
    'redis' => [
        'host' => getenv('REDIS_HOST') ?: 'redis',
        'port' => (int) (getenv('REDIS_PORT') ?: 6379),
        'ttl'  => 60,
    ],
];