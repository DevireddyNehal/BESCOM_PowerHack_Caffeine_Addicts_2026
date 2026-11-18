<?php
declare(strict_types=1);

function getDatabaseConnection(): PDO
{
    $dbPath = getenv('BESCOM_DB_PATH') ?: dirname(__DIR__) . '/bescom-demo.sqlite';
    if (!class_exists(PDO::class) || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        respond(500, ['error' => 'PHP PDO SQLite is required to run the demo backend.']);
    }
    try {
        $db = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $db->exec('PRAGMA foreign_keys = ON');
        return $db;
    } catch (PDOException $error) {
        respond(500, ['error' => 'PHP PDO SQLite is required to run the demo backend.']);
    }
}
