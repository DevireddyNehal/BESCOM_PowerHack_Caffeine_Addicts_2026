<?php
declare(strict_types=1);

class AuthController
{
    public static function handleLogin(PDO $db): void
    {
        requireMethod('POST');
        $request = readJsonBody();
        $username = $request['username'] ?? '';
        $password = $request['password'] ?? '';
        if (!is_string($username) || !is_string($password)) {
            respond(422, ['error' => 'Username and password must be text.']);
        }
        $username = trim($username);
        $user = $username === '' ? null : AuthService::findUser($db, $username);
        if ($user === null || !password_verify($password, $user['password_hash'])) {
            respond(401, ['error' => 'Username or password is incorrect.']);
        }
        if ($user['account_status'] === 'suspended') {
            respond(403, ['error' => 'This demo account is suspended. Contact the service desk.']);
        }
        if ($user['role'] === 'worker' && $user['account_status'] !== 'active') {
            respond(403, ['error' => 'This worker account is inactive. Contact an administrator.']);
        }

        if ($user['role'] !== 'customer') {
            $_SESSION = [];
            session_regenerate_id(true);
            $_SESSION['username'] = $user['username'];
            respond(200, ['authenticated' => true, 'user' => AuthService::safeUser($user)]);
        }

        $code = AuthService::createOtpChallenge($db, $username);
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['pending_username'] = $username;
        respond(200, [
            'requires_otp' => true,
            'message' => 'Demo one-time code created. No SMS is sent in this prototype.',
            'demo_otp' => $code,
            'expires_in_seconds' => 300,
        ]);
    }

    public static function handleVerifyOtp(PDO $db): void
    {
        requireMethod('POST');
        $username = $_SESSION['pending_username'] ?? '';
        if (!is_string($username) || $username === '') {
            respond(401, ['error' => 'Start sign-in again to request a new code.']);
        }
        $request = readJsonBody();
        $code = $request['code'] ?? '';
        if (!is_string($code)) {
            respond(422, ['error' => 'Code must be text.']);
        }
        $code = trim($code);
        $query = $db->prepare('SELECT * FROM otp_challenges WHERE username = :username');
        $query->execute(['username' => $username]);
        $challenge = $query->fetch();
        if ($challenge === false) {
            unset($_SESSION['pending_username']);
            respond(401, ['error' => 'No active code. Sign in again.']);
        }
        if ((int) $challenge['expires_at'] < time() || (int) $challenge['attempts'] >= 5) {
            $db->prepare('DELETE FROM otp_challenges WHERE username = :username')->execute(['username' => $username]);
            unset($_SESSION['pending_username']);
            respond(401, ['error' => 'The code expired or its attempt limit was reached. Sign in again.']);
        }
        if (!password_verify($code, $challenge['code_hash'])) {
            $db->prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE username = :username')
                ->execute(['username' => $username]);
            respond(401, ['error' => 'That code is not correct.']);
        }

        $db->prepare('DELETE FROM otp_challenges WHERE username = :username')->execute(['username' => $username]);
        $user = AuthService::findUser($db, $username);
        if ($user === null) {
            unset($_SESSION['pending_username']);
            respond(401, ['error' => 'Account not found.']);
        }
        session_regenerate_id(true);
        unset($_SESSION['pending_username']);
        $_SESSION['username'] = $username;
        respond(200, ['authenticated' => true, 'user' => AuthService::safeUser($user)]);
    }

    public static function handleMe(PDO $db): void
    {
        requireMethod('GET');
        respond(200, ['user' => AuthService::safeUser(AuthService::requireUser($db))]);
    }

    public static function handleLogout(): void
    {
        requireMethod('POST');
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(200, ['ok' => true]);
    }
}
