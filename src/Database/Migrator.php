<?php
declare(strict_types=1);

class Migrator
{
    public static function migrate(PDO $db): void
    {
        $schema = [
            'CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ("admin", "customer", "worker")),
                password_hash TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT "",
                email TEXT NOT NULL DEFAULT "",
                service_area TEXT NOT NULL DEFAULT "",
                account_status TEXT NOT NULL DEFAULT "active"
            )',
            'CREATE TABLE IF NOT EXISTS usage_samples (
                sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_username TEXT NOT NULL REFERENCES users(username),
                month TEXT NOT NULL,
                kwh REAL NOT NULL,
                UNIQUE(customer_username, month)
            )',
            'CREATE TABLE IF NOT EXISTS complaints (
                complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_username TEXT NOT NULL REFERENCES users(username),
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT "OPEN",
                assigned_worker TEXT REFERENCES users(username),
                worker_note TEXT NOT NULL DEFAULT "",
                penalty_review INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS notifications (
                notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_username TEXT NOT NULL REFERENCES users(username),
                kind TEXT NOT NULL,
                message TEXT NOT NULL,
                channel TEXT NOT NULL DEFAULT "in-app",
                created_at TEXT NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS otp_challenges (
                username TEXT PRIMARY KEY REFERENCES users(username),
                code_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            )',
        ];

        foreach ($schema as $statement) {
            $db->exec($statement);
        }
    }

    public static function seed(PDO $db): void
    {
        $seedUsers = [
            ['admin', 'Demo Administrator', 'admin', '', 'admin@example.invalid'],
            ['BES-10001', 'Asha Rao', 'customer', 'Whitefield', 'asha@example.invalid'],
            ['worker01', 'Ravi Kumar', 'worker', '', 'worker@example.invalid'],
        ];
        $insertUser = $db->prepare(
            'INSERT OR IGNORE INTO users
             (username, full_name, role, password_hash, phone, email, service_area, account_status)
             VALUES (:username, :full_name, :role, :password_hash, :phone, :email, :service_area, "active")'
        );
        foreach ($seedUsers as [$username, $name, $role, $area, $email]) {
            if (AuthService::findUser($db, $username) !== null) {
                continue;
            }
            $insertUser->execute([
                'username' => $username,
                'full_name' => $name,
                'role' => $role,
                'password_hash' => password_hash('Demo123!', PASSWORD_DEFAULT),
                'phone' => $role === 'customer' ? '+91 90000 10001' : '',
                'email' => $email,
                'service_area' => $area,
            ]);
        }

        $usageSamples = [
            ['2026-06', 248], ['2026-07', 276], ['2026-08', 262],
            ['2026-09', 291], ['2026-10', 303], ['2026-11', 158],
        ];
        $insertUsage = $db->prepare(
            'INSERT OR IGNORE INTO usage_samples (customer_username, month, kwh)
             VALUES ("BES-10001", :month, :kwh)'
        );
        foreach ($usageSamples as [$month, $kwh]) {
            $insertUsage->execute(['month' => $month, 'kwh' => $kwh]);
        }

        if ((int) $db->query('SELECT COUNT(*) FROM complaints')->fetchColumn() === 0) {
            $sampleId = ComplaintService::insertComplaint(
                $db,
                'BES-10001',
                'Low voltage',
                'Lights dim briefly during the evening peak.',
                'Whitefield'
            );
            ComplaintService::notify($db, 'admin', 'new_complaint', 'Demo complaint #' . $sampleId . ' is waiting for review.');
        }
    }
}
