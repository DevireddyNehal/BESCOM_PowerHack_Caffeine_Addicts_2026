// ===================== DEVELOPER SNIPPETS =====================
const PHP = `<?php
declare(strict_types=1);

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
ini_set('session.use_strict_mode', '1');
session_start();

function respond(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        http_response_code(500);
        echo '{"error":"Could not encode the response."}';
        exit;
    }

    echo $json;
    exit;
}

set_exception_handler(static function (Throwable $error): void {
    error_log($error->__toString());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo '{"error":"Unexpected server error. Check the PHP server log."}';
});

function requireMethod(string $expected): void
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($method !== $expected) {
        header('Allow: ' . $expected);
        respond(405, ['error' => 'Use ' . $expected . ' for this endpoint.']);
    }
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        respond(400, ['error' => 'Request body must contain valid JSON.']);
    }

    if (!is_array($payload)) {
        respond(400, ['error' => 'Request body must be a JSON object.']);
    }

    return $payload;
}

function requiredText(array $data, string $key, int $maxLength): string
{
    if (!isset($data[$key]) || !is_string($data[$key])) {
        respond(422, ['error' => $key . ' must be text.']);
    }
    $value = trim($data[$key]);
    if ($value === '' || strlen($value) > $maxLength) {
        respond(422, ['error' => $key . ' is required and must be at most ' . $maxLength . ' characters.']);
    }
    return $value;
}

function numberField(array $data, string $key, float $default): float
{
    if (!array_key_exists($key, $data)) {
        return $default;
    }
    if (!is_numeric($data[$key])) {
        respond(422, ['error' => $key . ' must be a finite number.']);
    }
    $value = (float) $data[$key];
    if (!is_finite($value)) {
        respond(422, ['error' => $key . ' must be a finite number.']);
    }
    return $value;
}

function safeUser(array $user): array
{
    return [
        'username' => $user['username'],
        'full_name' => $user['full_name'],
        'role' => $user['role'],
        'service_area' => $user['service_area'],
        'account_status' => $user['account_status'],
    ];
}

function findUser(PDO $db, string $username): ?array
{
    $query = $db->prepare('SELECT * FROM users WHERE username = :username');
    $query->execute(['username' => $username]);
    $user = $query->fetch();
    return $user === false ? null : $user;
}

function requireUser(PDO $db): array
{
    $username = $_SESSION['username'] ?? '';
    if (!is_string($username) || $username === '') {
        respond(401, ['error' => 'Please sign in again.']);
    }

    $user = findUser($db, $username);
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

function requireRole(PDO $db, string $role): array
{
    $user = requireUser($db);
    if ($user['role'] !== $role) {
        respond(403, ['error' => 'Your account cannot access this panel.']);
    }
    return $user;
}

function notify(PDO $db, string $recipient, string $kind, string $message, string $channel = 'in-app'): void
{
    $query = $db->prepare(
        'INSERT INTO notifications (recipient_username, kind, message, channel, created_at)
         VALUES (:recipient, :kind, :message, :channel, :created_at)'
    );
    $query->execute([
        'recipient' => $recipient,
        'kind' => $kind,
        'message' => $message,
        'channel' => $channel,
        'created_at' => gmdate(DATE_ATOM),
    ]);
}

function getNotifications(PDO $db, string $username): array
{
    $query = $db->prepare(
        'SELECT notification_id, kind, message, channel, created_at
         FROM notifications WHERE recipient_username = :username
         ORDER BY notification_id DESC LIMIT 50'
    );
    $query->execute(['username' => $username]);
    return $query->fetchAll();
}

function getCustomerComplaints(PDO $db, string $username): array
{
    $query = $db->prepare(
        'SELECT c.complaint_id, c.category, c.description, c.location, c.status,
                c.worker_note, c.penalty_review, c.created_at, c.updated_at,
                w.full_name AS worker_name
         FROM complaints c
         LEFT JOIN users w ON w.username = c.assigned_worker
         WHERE c.customer_username = :username
         ORDER BY c.complaint_id DESC LIMIT 50'
    );
    $query->execute(['username' => $username]);
    return $query->fetchAll();
}

function getAdminComplaints(PDO $db): array
{
    return $db->query(
        'SELECT c.complaint_id, c.customer_username, c.category, c.description,
                c.location, c.status, c.assigned_worker, c.worker_note,
                c.penalty_review, c.created_at, c.updated_at,
                u.full_name AS customer_name, u.phone AS customer_phone,
                u.email AS customer_email, w.full_name AS worker_name
         FROM complaints c
         JOIN users u ON u.username = c.customer_username
         LEFT JOIN users w ON w.username = c.assigned_worker
         ORDER BY CASE c.status
           WHEN "OPEN" THEN 0 WHEN "ASSIGNED" THEN 1 WHEN "IN_PROGRESS" THEN 2
           WHEN "BLOCKED" THEN 3 ELSE 4 END, c.complaint_id DESC'
    )->fetchAll();
}

function insertComplaint(PDO $db, string $customer, string $category, string $description, string $location): int
{
    $now = gmdate(DATE_ATOM);
    $query = $db->prepare(
        'INSERT INTO complaints
         (customer_username, category, description, location, status, created_at, updated_at)
         VALUES (:customer, :category, :description, :location, "OPEN", :created_at, :updated_at)'
    );
    $query->execute([
        'customer' => $customer,
        'category' => $category,
        'description' => $description,
        'location' => $location,
        'created_at' => $now,
        'updated_at' => $now,
    ]);
    return (int) $db->lastInsertId();
}

$dbPath = getenv('BESCOM_DB_PATH') ?: __DIR__ . '/bescom-demo.sqlite';
if (!class_exists(PDO::class) || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    respond(500, ['error' => 'PHP PDO SQLite is required to run the demo backend.']);
}
try {
    $db = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $error) {
    respond(500, ['error' => 'PHP PDO SQLite is required to run the demo backend.']);
}

try {
    $db->exec('PRAGMA foreign_keys = ON');
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
        if (findUser($db, $username) !== null) {
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
        $sampleId = insertComplaint(
            $db,
            'BES-10001',
            'Low voltage',
            'Lights dim briefly during the evening peak.',
            'Whitefield'
        );
        notify($db, 'admin', 'new_complaint', 'Demo complaint #' . $sampleId . ' is waiting for review.');
    }
} catch (PDOException $error) {
    respond(500, ['error' => 'Could not initialize the demo database.']);
}

$path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($path === '/' || $path === '/bescom-feeder-dashboard.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/bescom-feeder-dashboard.html');
    exit;
}

if ($path === '/health' && $method === 'GET') {
    respond(200, ['status' => 'ok', 'source' => 'demo']);
}

if ($path === '/api/auth/login') {
    requireMethod('POST');
    $request = readJsonBody();
    $username = $request['username'] ?? '';
    $password = $request['password'] ?? '';
    if (!is_string($username) || !is_string($password)) {
        respond(422, ['error' => 'Username and password must be text.']);
    }
    $username = trim($username);
    $user = $username === '' ? null : findUser($db, $username);
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
        respond(200, ['authenticated' => true, 'user' => safeUser($user)]);
    }

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

if ($path === '/api/auth/verify-otp') {
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
    $user = findUser($db, $username);
    if ($user === null) {
        unset($_SESSION['pending_username']);
        respond(401, ['error' => 'Account not found.']);
    }
    session_regenerate_id(true);
    unset($_SESSION['pending_username']);
    $_SESSION['username'] = $username;
    respond(200, ['authenticated' => true, 'user' => safeUser($user)]);
}

if ($path === '/api/auth/me') {
    requireMethod('GET');
    respond(200, ['user' => safeUser(requireUser($db))]);
}

if ($path === '/api/auth/logout') {
    requireMethod('POST');
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], '', $params['secure'], $params['httponly']);
    }
    session_destroy();
    respond(200, ['ok' => true]);
}

if ($path === '/api/customer/overview') {
    requireMethod('GET');
    $user = requireRole($db, 'customer');
    $usageQuery = $db->prepare(
        'SELECT month, kwh FROM usage_samples WHERE customer_username = :username ORDER BY month'
    );
    $usageQuery->execute(['username' => $user['username']]);
    respond(200, [
        'user' => safeUser($user),
        'usage' => $usageQuery->fetchAll(),
        'complaints' => getCustomerComplaints($db, $user['username']),
        'notifications' => getNotifications($db, $user['username']),
    ]);
}

if ($path === '/api/location/confirm') {
    requireMethod('POST');
    $user = requireRole($db, 'customer');
    $request = readJsonBody();
    $location = requiredText($request, 'location', 180);
    $normalized = strtolower($location);
    $serviceAreas = ['whitefield', 'bengaluru', 'bangalore', 'yelahanka', 'koramangala', 'electronic city', 'rajajinagar'];
    $inCoverage = false;
    foreach ($serviceAreas as $area) {
        if (strpos($normalized, $area) !== false) {
            $inCoverage = true;
            break;
        }
    }
    $matchesAccount = $user['service_area'] !== ''
        && strpos($normalized, strtolower($user['service_area'])) !== false;
    $confirmed = $inCoverage && $matchesAccount;
    if ($confirmed) {
        $_SESSION['confirmed_location'] = $user['service_area'];
    } else {
        unset($_SESSION['confirmed_location']);
    }
    respond(200, [
        'confirmed' => $confirmed,
        'service_area_valid' => $inCoverage,
        'matches_registered_area' => $matchesAccount,
        'registered_area' => $user['service_area'],
        'message' => $confirmed
            ? 'Location confirmed against the demo coverage list and your account.'
            : 'We could not confirm that location for this account. Check the spelling or contact the service desk.',
    ]);
}

if ($path === '/api/customer/complaints') {
    requireMethod('POST');
    $user = requireRole($db, 'customer');
    $location = $_SESSION['confirmed_location'] ?? '';
    if (!is_string($location) || $location === '' || $location !== $user['service_area']) {
        respond(403, ['error' => 'Confirm your registered service location before submitting a complaint.']);
    }
    $request = readJsonBody();
    $category = requiredText($request, 'category', 80);
    $description = requiredText($request, 'description', 1000);
    $complaintId = insertComplaint($db, $user['username'], $category, $description, $location);
    $admins = $db->query('SELECT username FROM users WHERE role = "admin"')->fetchAll();
    foreach ($admins as $admin) {
        notify($db, $admin['username'], 'new_complaint', 'New customer complaint #' . $complaintId . ' is ready for review.');
    }
    unset($_SESSION['confirmed_location']);
    respond(201, ['complaint_id' => $complaintId, 'status' => 'OPEN', 'message' => 'Your demo complaint was submitted to the admin queue.']);
}

if ($path === '/api/admin/overview') {
    requireMethod('GET');
    requireRole($db, 'admin');
    $complaints = getAdminComplaints($db);
    $customers = $db->query(
        'SELECT username, full_name, phone, email, service_area, account_status
         FROM users WHERE role = "customer" ORDER BY full_name'
    )->fetchAll();
    $workers = $db->query(
        'SELECT username, full_name, account_status FROM users
         WHERE role = "worker" AND account_status = "active" ORDER BY full_name'
    )->fetchAll();
    $workerAccounts = $db->query(
        'SELECT username, full_name, account_status FROM users WHERE role = "worker" ORDER BY full_name'
    )->fetchAll();
    $notifications = getNotifications($db, 'admin');
    $openCount = count(array_filter($complaints, static fn (array $case): bool => !in_array($case['status'], ['RESOLVED', 'CLOSED'], true)));
    $unassignedCount = count(array_filter($complaints, static fn (array $case): bool => $case['assigned_worker'] === null && $case['status'] !== 'RESOLVED'));
    $workerUpdates = count(array_filter($complaints, static fn (array $case): bool => $case['worker_note'] !== ''));
    $penaltyCount = count(array_filter($complaints, static fn (array $case): bool => (int) $case['penalty_review'] === 1));
    respond(200, [
        'complaints' => $complaints,
        'customers' => $customers,
        'workers' => $workers,
        'worker_accounts' => $workerAccounts,
        'notifications' => $notifications,
        'metrics' => [
            'open' => $openCount,
            'unassigned' => $unassignedCount,
            'worker_updates' => $workerUpdates,
            'penalty_reviews' => $penaltyCount,
        ],
    ]);
}

if ($path === '/api/admin/workers') {
    requireMethod('POST');
    requireRole($db, 'admin');
    $request = readJsonBody();
    $username = requiredText($request, 'username', 64);
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/D', $username)) {
        respond(422, ['error' => 'Worker ID must be 3–64 letters, numbers, dots, underscores, or hyphens.']);
    }
    $fullName = requiredText($request, 'full_name', 120);
    $password = $request['password'] ?? null;
    if (!is_string($password) || trim($password) === '' || strlen($password) < 10 || strlen($password) > 128) {
        respond(422, ['error' => 'Set a password between 10 and 128 characters.']);
    }
    if (findUser($db, $username) !== null) {
        respond(409, ['error' => 'That worker ID is already in use.']);
    }

    $insert = $db->prepare(
        'INSERT OR IGNORE INTO users
         (username, full_name, role, password_hash, phone, email, service_area, account_status)
         VALUES (:username, :full_name, "worker", :password_hash, "", "", "", "active")'
    );
    $insert->execute([
        'username' => $username,
        'full_name' => $fullName,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);
    if ($insert->rowCount() !== 1) {
        respond(409, ['error' => 'That worker ID is already in use.']);
    }
    $worker = findUser($db, $username);
    if ($worker === null) {
        respond(500, ['error' => 'Worker account was created but could not be loaded.']);
    }
    respond(201, ['worker' => safeUser($worker)]);
}

if ($path === '/api/admin/workers/status') {
    requireMethod('POST');
    requireRole($db, 'admin');
    $request = readJsonBody();
    $username = requiredText($request, 'username', 64);
    $active = $request['active'] ?? null;
    if (!is_bool($active)) {
        respond(422, ['error' => 'Choose whether worker access should be active.']);
    }
    $worker = findUser($db, $username);
    if ($worker === null || $worker['role'] !== 'worker') {
        respond(404, ['error' => 'Worker account not found.']);
    }
    if (!$active) {
        $assigned = $db->prepare(
            'SELECT COUNT(*) FROM complaints
             WHERE assigned_worker = :username AND status NOT IN ("RESOLVED", "CLOSED")'
        );
        $assigned->execute(['username' => $username]);
        if ((int) $assigned->fetchColumn() > 0) {
            respond(409, ['error' => 'Reassign or resolve this worker’s open requests before deactivating access.']);
        }
    }
    $status = $active ? 'active' : 'inactive';
    $db->prepare('UPDATE users SET account_status = :status WHERE username = :username')
        ->execute(['status' => $status, 'username' => $username]);
    respond(200, ['ok' => true, 'account_status' => $status]);
}

if ($path === '/api/admin/complaints/action') {
    requireMethod('POST');
    requireRole($db, 'admin');
    $request = readJsonBody();
    $complaintId = filter_var($request['complaint_id'] ?? null, FILTER_VALIDATE_INT);
    if ($complaintId === false || $complaintId < 1) {
        respond(422, ['error' => 'A valid complaint_id is required.']);
    }
    $caseQuery = $db->prepare('SELECT * FROM complaints WHERE complaint_id = :id');
    $caseQuery->execute(['id' => $complaintId]);
    $case = $caseQuery->fetch();
    if ($case === false) {
        respond(404, ['error' => 'Complaint not found.']);
    }

    $action = (string) ($request['action'] ?? '');
    $now = gmdate(DATE_ATOM);
    if ($action === 'assign') {
        $workerUsername = requiredText($request, 'worker_username', 64);
        $worker = findUser($db, $workerUsername);
        if ($worker === null || $worker['role'] !== 'worker' || $worker['account_status'] !== 'active') {
            respond(422, ['error' => 'Choose an active demo worker.']);
        }
        $status = $case['status'] === 'OPEN' ? 'ASSIGNED' : $case['status'];
        $db->prepare(
            'UPDATE complaints SET assigned_worker = :worker, status = :status, updated_at = :updated
             WHERE complaint_id = :id'
        )->execute(['worker' => $workerUsername, 'status' => $status, 'updated' => $now, 'id' => $complaintId]);
        notify($db, $workerUsername, 'assignment', 'Complaint #' . $complaintId . ' was assigned to you.');
        notify($db, $case['customer_username'], 'case_update', 'A field worker was assigned to complaint #' . $complaintId . '.');
    } elseif ($action === 'status') {
        $status = $request['status'] ?? '';
        if (!is_string($status)) {
            respond(422, ['error' => 'Unsupported complaint status.']);
        }
        if (!in_array($status, ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED'], true)) {
            respond(422, ['error' => 'Unsupported complaint status.']);
        }
        $db->prepare('UPDATE complaints SET status = :status, updated_at = :updated WHERE complaint_id = :id')
            ->execute(['status' => $status, 'updated' => $now, 'id' => $complaintId]);
        notify($db, $case['customer_username'], 'case_update', 'Admin updated complaint #' . $complaintId . ' to ' . $status . '.');
    } elseif ($action === 'penalty_review') {
        $db->prepare('UPDATE complaints SET penalty_review = 1, updated_at = :updated WHERE complaint_id = :id')
            ->execute(['updated' => $now, 'id' => $complaintId]);
        notify($db, 'admin', 'penalty_review', 'Complaint #' . $complaintId . ' was flagged for a human penalty review.');
    } else {
        respond(422, ['error' => 'Unsupported admin action.']);
    }

    respond(200, ['ok' => true]);
}

if ($path === '/api/admin/customers/notice') {
    requireMethod('POST');
    requireRole($db, 'admin');
    $request = readJsonBody();
    $customerUsername = requiredText($request, 'customer_username', 64);
    $channel = $request['channel'] ?? '';
    if (!is_string($channel)) {
        respond(422, ['error' => 'Choose email, SMS, or call.']);
    }
    if (!in_array($channel, ['email', 'sms', 'call'], true)) {
        respond(422, ['error' => 'Choose email, SMS, or call.']);
    }
    $customer = findUser($db, $customerUsername);
    if ($customer === null || $customer['role'] !== 'customer') {
        respond(404, ['error' => 'Customer account not found.']);
    }
    notify(
        $db,
        $customerUsername,
        'removal_notice',
        'Demo service review notice: an administrator requested a conversation before any account or service change. This is not a disconnection.',
        $channel
    );
    respond(200, ['ok' => true, 'message' => 'Demo notice recorded. No email, SMS, or call was sent.']);
}

if ($path === '/api/admin/customers/request-removal') {
    requireMethod('POST');
    requireRole($db, 'admin');
    $request = readJsonBody();
    $customerUsername = requiredText($request, 'customer_username', 64);
    $customer = findUser($db, $customerUsername);
    if ($customer === null || $customer['role'] !== 'customer') {
        respond(404, ['error' => 'Customer account not found.']);
    }
    $noticeQuery = $db->prepare(
        'SELECT COUNT(*) FROM notifications
         WHERE recipient_username = :username AND kind = "removal_notice"
           AND created_at >= :cutoff'
    );
    $noticeQuery->execute([
        'username' => $customerUsername,
        'cutoff' => gmdate(DATE_ATOM, time() - 30 * 86400),
    ]);
    if ((int) $noticeQuery->fetchColumn() < 1) {
        respond(409, ['error' => 'Send a customer notice before requesting removal review.']);
    }
    $db->prepare('UPDATE users SET account_status = "pending_removal" WHERE username = :username')
        ->execute(['username' => $customerUsername]);
    notify($db, $customerUsername, 'removal_review', 'An account-removal request is pending human review. Your service has not been disconnected.');
    respond(200, ['ok' => true, 'account_status' => 'pending_removal']);
}

if ($path === '/api/worker/tasks') {
    requireMethod('GET');
    $worker = requireRole($db, 'worker');
    $query = $db->prepare(
        'SELECT c.complaint_id, c.category, c.description, c.location, c.status,
                c.worker_note, c.created_at, c.updated_at, u.full_name AS customer_name
         FROM complaints c JOIN users u ON u.username = c.customer_username
         WHERE c.assigned_worker = :worker ORDER BY c.complaint_id DESC'
    );
    $query->execute(['worker' => $worker['username']]);
    respond(200, ['user' => safeUser($worker), 'tasks' => $query->fetchAll()]);
}

if ($path === '/api/worker/tasks/update') {
    requireMethod('POST');
    $worker = requireRole($db, 'worker');
    $request = readJsonBody();
    $complaintId = filter_var($request['complaint_id'] ?? null, FILTER_VALIDATE_INT);
    $status = $request['status'] ?? '';
    if (!is_string($status)) {
        respond(422, ['error' => 'Choose a valid work status.']);
    }
    $note = requiredText($request, 'note', 1000);
    if ($complaintId === false || $complaintId < 1) {
        respond(422, ['error' => 'A valid complaint_id is required.']);
    }
    if (!in_array($status, ['IN_PROGRESS', 'BLOCKED', 'RESOLVED'], true)) {
        respond(422, ['error' => 'Choose a valid work status.']);
    }
    $caseQuery = $db->prepare('SELECT * FROM complaints WHERE complaint_id = :id AND assigned_worker = :worker');
    $caseQuery->execute(['id' => $complaintId, 'worker' => $worker['username']]);
    $case = $caseQuery->fetch();
    if ($case === false) {
        respond(404, ['error' => 'This complaint is not assigned to your account.']);
    }
    $now = gmdate(DATE_ATOM);
    $db->prepare(
        'UPDATE complaints SET status = :status, worker_note = :note, updated_at = :updated
         WHERE complaint_id = :id'
    )->execute(['status' => $status, 'note' => $note, 'updated' => $now, 'id' => $complaintId]);

    $message = 'Worker update for complaint #' . $complaintId . ': ' . $status . ' — ' . $note;
    $admins = $db->query('SELECT username FROM users WHERE role = "admin"')->fetchAll();
    foreach ($admins as $admin) {
        notify($db, $admin['username'], 'worker_update', $message);
    }
    notify($db, $case['customer_username'], 'case_update', $message);
    respond(200, ['ok' => true]);
}

if ($path === '/api/v1/telemetry/15min') {
    requireMethod('GET');
    $ratings = ['DTR-01' => 250.0, 'DTR-02' => 200.0, 'DTR-03' => 160.0];
    $loads = ['DTR-01' => 212.5, 'DTR-02' => 212.5, 'DTR-03' => 150.4];
    $transformers = [];
    foreach ($ratings as $id => $rating) {
        $load = $loads[$id];
        $transformers[] = [
            'dtr_id' => $id,
            'nameplate_kva' => $rating,
            'active_load_kva' => $load,
            'loading_pct' => round(($load / $rating) * 100, 1),
            'source' => 'simulated',
        ];
    }
    respond(200, ['feeder_id' => 'BESCOM-F11-DEMO', 'source' => 'demo', 'transformers' => $transformers]);
}

if ($path === '/api/v1/scenario/simulate-transfer') {
    requireMethod('POST');
    $request = readJsonBody();
    $ratings = ['DTR-01' => 250.0, 'DTR-02' => 200.0, 'DTR-03' => 160.0];
    $loads = $request['base_loads_kva'] ?? ['DTR-01' => 212.5, 'DTR-02' => 212.5, 'DTR-03' => 150.4];
    if (!is_array($loads)) {
        respond(422, ['error' => 'base_loads_kva must be an object.']);
    }
    $validatedLoads = [];
    foreach ($ratings as $id => $rating) {
        if (!isset($loads[$id]) || !is_numeric($loads[$id])
            || !is_finite((float) $loads[$id]) || (float) $loads[$id] < 0) {
            respond(422, ['error' => 'Valid non-negative base loads are required for all three transformers.']);
        }
        $validatedLoads[$id] = (float) $loads[$id];
    }
    $t12 = numberField($request, 'tie_12_kva_to_dtr01', 0);
    $t13 = numberField($request, 'tie_13_kva_to_dtr01', 0);
    $t23 = numberField($request, 'tie_23_kva_to_dtr03', 0);
    if (!is_finite($t12) || !is_finite($t13) || !is_finite($t23)
        || abs($t12) > 60 || abs($t13) > 50 || abs($t23) > 40) {
        respond(422, ['error' => 'Transfer must be finite and within demo tie-link capacities.']);
    }
    $post = [
        'DTR-01' => $validatedLoads['DTR-01'] + $t12 + $t13,
        'DTR-02' => $validatedLoads['DTR-02'] - $t12 - $t23,
        'DTR-03' => $validatedLoads['DTR-03'] - $t13 + $t23,
    ];
    $loading = [];
    $drop = [];
    foreach ($post as $id => $load) {
        if ($load < 0) {
            respond(422, ['error' => 'Transfer cannot move more load than a transformer carries.']);
        }
        $loading[$id] = round(($load / $ratings[$id]) * 100, 1);
        $drop[$id] = round(($load / $ratings[$id]) * 3.8, 1);
    }
    $overloaded = array_keys(array_filter($loading, static fn (float $pct): bool => $pct >= 100));
    $nearLimit = array_keys(array_filter($loading, static fn (float $pct): bool => $pct >= 90 && $pct < 100));
    $maxDrop = max($drop);
    respond(200, [
        'source' => 'demo_heuristic',
        'post_transfer_load_kva' => $post,
        'post_transfer_loading_pct' => $loading,
        'voltage_drop_pct' => $drop,
        'max_voltage_drop_pct' => $maxDrop,
        'voltage_within_6pct' => $maxDrop <= 6,
        'overloaded_transformers' => $overloaded,
        'near_limit_transformers' => $nearLimit,
        'requires_human_approval' => true,
        'autonomous_switching_permitted' => false,
    ]);
}

if ($path === '/api/v1/forecast/predict') {
    requireMethod('POST');
    $request = readJsonBody();
    $loads = $request['loads_kva'] ?? ['DTR-01' => 212.5, 'DTR-02' => 212.5, 'DTR-03' => 150.4];
    if (!is_array($loads)) {
        respond(422, ['error' => 'loads_kva must be an object.']);
    }
    $predictions = [];
    foreach (['DTR-01', 'DTR-02', 'DTR-03'] as $id) {
        if (!isset($loads[$id]) || !is_numeric($loads[$id]) || !is_finite((float) $loads[$id]) || (float) $loads[$id] < 0) {
            respond(422, ['error' => 'Valid non-negative loads are required for all three transformers.']);
        }
        $predictions[$id] = round((float) $loads[$id] * 1.03, 1);
    }
    respond(200, [
        'horizon' => '15_minutes',
        'source' => 'demo_heuristic',
        'predictions_kva' => $predictions,
        'note' => 'Illustrative estimate only; not a trained or live forecasting model.',
    ]);
}

respond(404, ['error' => 'Endpoint not found.']);
`;
const SQL = `-- BESCOM Smart Grid Digital Twin: PostgreSQL Time-Series & Audit Schema
CREATE TABLE dtr_assets (
    dtr_id VARCHAR(16) PRIMARY KEY,
    feeder_id VARCHAR(32) NOT NULL,
    nameplate_kva NUMERIC(6,2) NOT NULL,
    installed_year INT,
    hv_kv NUMERIC(5,2) DEFAULT 11.00,
    lv_kv NUMERIC(5,3) DEFAULT 0.415
);

CREATE TABLE telemetry_15min (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL,
    dtr_id VARCHAR(16) REFERENCES dtr_assets(dtr_id),
    active_kva NUMERIC(7,2) NOT NULL,
    loading_pct NUMERIC(5,2) NOT NULL,
    lt_voltage_kv NUMERIC(5,3) NOT NULL,
    anomaly_score NUMERIC(4,3) NOT NULL,
    anomaly_reason TEXT,
    quality_gate_passed BOOLEAN DEFAULT TRUE
);

CREATE TABLE operator_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    operator_id VARCHAR(32) NOT NULL,
    scenario_label VARCHAR(64) NOT NULL,
    switching_plan JSONB NOT NULL,
    post_transfer_loadings JSONB NOT NULL,
    decision VARCHAR(16) CHECK (decision IN ('APPROVED', 'REJECTED')) NOT NULL
);`;
function copyCode(id){
  const t=document.getElementById(id).textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(()=>showToast('Copied','Code copied to clipboard.'));
  else { const a=document.createElement('textarea'); a.value=t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); showToast('Copied','Code copied to clipboard.'); }
}
function downloadBundle(){
  const url = URL.createObjectURL(new Blob([PHP],{type:'application/x-httpd-php'}));
  const a=document.createElement('a'); a.href=url; a.download='backend.php'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Downloaded','Saved backend.php');
}
