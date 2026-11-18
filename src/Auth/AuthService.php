<?php
declare(strict_types=1);

class AuthService
{
    public static function safeUser(array $user): array
    {
        return [
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'service_area' => $user['service_area'],
            'account_status' => $user['account_status'],
        ];
    }

    public static function findUser(PDO $db, string $username): ?array
    {
        $query = $db->prepare('SELECT * FROM users WHERE username = :username');
        $query->execute(['username' => $username]);
        $user = $query->fetch();
        return $user === false ? null : $user;
    }

    public static function requireUser(PDO $db): array
    {
        $username = $_SESSION['username'] ?? '';
        if (!is_string($username) || $username === '') {
            respond(401, ['error' => 'Please sign in again.']);
        }

        $user = self::findUser($db, $username);
        if ($user === null) {
            session_destroy();
            respond(401, ['error' => 'Please sign in again.']);
        }
        if ($user['role'] === 'worker' && $user['account_status'] !== 'active') {
            $_SESSION = [];
            session_destroy();
            respond(403, ['error' => 'This worker account is inactive. Contact an administrator.']);
        }
        return $user;
    }

    public static function requireRole(PDO $db, string $role): array
    {
        $user = self::requireUser($db);
        if ($user['role'] !== $role) {
            respond(403, ['error' => 'Your account cannot access this panel.']);
        }
        return $user;
    }

    public static function createOtpChallenge(PDO $db, string $username): string
    {
        $code = (string) random_int(100000, 999999);
        $challenge = $db->prepare(
            'INSERT INTO otp_challenges (username, code_hash, expires_at, attempts)
             VALUES (:username, :code_hash, :expires_at, 0)
             ON CONFLICT(username) DO UPDATE SET code_hash = excluded.code_hash,
               expires_at = excluded.expires_at, attempts = 0'
        );
        $challenge->execute([
            'username' => $username,
            'code_hash' => password_hash($code, PASSWORD_DEFAULT),
            'expires_at' => time() + 300,
        ]);
        return $code;
    }
}
