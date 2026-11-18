<?php
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

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/src/Auth/AuthService.php';
require_once __DIR__ . '/src/Services/ComplaintService.php';
require_once __DIR__ . '/src/Services/SimulationService.php';
require_once __DIR__ . '/src/Services/TelemetryService.php';
require_once __DIR__ . '/src/Database/Migrator.php';
require_once __DIR__ . '/src/Controllers/AuthController.php';
require_once __DIR__ . '/src/Controllers/CustomerController.php';
require_once __DIR__ . '/src/Controllers/AdminController.php';
require_once __DIR__ . '/src/Controllers/WorkerController.php';
require_once __DIR__ . '/src/Controllers/TelemetryController.php';

try {
    $db = getDatabaseConnection();
    Migrator::migrate($db);
    Migrator::seed($db);
} catch (PDOException $error) {
    respond(500, ['error' => 'Could not initialize the demo database.']);
}

$path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// Static asset delivery
if ($path === '/' || $path === '/index.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    exit;
}

if ($path === '/bescom-feeder-dashboard.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/bescom-feeder-dashboard.html');
    exit;
}

if (str_starts_with($path, '/public/')) {
    $localFile = __DIR__ . $path;
    if (file_exists($localFile) && is_file($localFile)) {
        $ext = pathinfo($localFile, PATHINFO_EXTENSION);
        $mimes = [
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'json' => 'application/json',
        ];
        header('Content-Type: ' . ($mimes[$ext] ?? 'text/plain'));
        readfile($localFile);
        exit;
    }
}

if ($path === '/health' && $method === 'GET') {
    respond(200, ['status' => 'ok', 'source' => 'demo']);
}

// API Routes
if ($path === '/api/auth/login') {
    AuthController::handleLogin($db);
}

if ($path === '/api/auth/verify-otp') {
    AuthController::handleVerifyOtp($db);
}

if ($path === '/api/auth/me') {
    AuthController::handleMe($db);
}

if ($path === '/api/auth/logout') {
    AuthController::handleLogout();
}

if ($path === '/api/customer/overview') {
    CustomerController::handleOverview($db);
}

if ($path === '/api/location/confirm') {
    CustomerController::handleConfirmLocation($db);
}

if ($path === '/api/customer/complaints') {
    CustomerController::handleSubmitComplaint($db);
}

if ($path === '/api/admin/overview') {
    AdminController::handleOverview($db);
}

if ($path === '/api/admin/workers') {
    AdminController::handleCreateWorker($db);
}

if ($path === '/api/admin/workers/status') {
    AdminController::handleWorkerStatus($db);
}

if ($path === '/api/admin/complaints/action') {
    AdminController::handleComplaintAction($db);
}

if ($path === '/api/admin/customers/notice') {
    AdminController::handleCustomerNotice($db);
}

if ($path === '/api/admin/customers/request-removal') {
    AdminController::handleRequestRemoval($db);
}

if ($path === '/api/worker/tasks') {
    WorkerController::handleTasks($db);
}

if ($path === '/api/worker/tasks/update') {
    WorkerController::handleTaskUpdate($db);
}

if ($path === '/api/v1/telemetry/15min') {
    TelemetryController::handleTelemetry();
}

if ($path === '/api/v1/scenario/simulate-transfer') {
    TelemetryController::handleSimulateTransfer();
}

if ($path === '/api/v1/forecast/predict') {
    TelemetryController::handleForecast();
}

respond(404, ['error' => 'Endpoint not found.']);
