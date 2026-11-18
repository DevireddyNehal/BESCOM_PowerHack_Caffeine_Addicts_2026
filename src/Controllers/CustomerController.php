<?php
declare(strict_types=1);

class CustomerController
{
    public static function handleOverview(PDO $db): void
    {
        requireMethod('GET');
        $user = AuthService::requireRole($db, 'customer');
        $usageQuery = $db->prepare(
            'SELECT month, kwh FROM usage_samples WHERE customer_username = :username ORDER BY month'
        );
        $usageQuery->execute(['username' => $user['username']]);
        respond(200, [
            'user' => AuthService::safeUser($user),
            'usage' => $usageQuery->fetchAll(),
            'complaints' => ComplaintService::getCustomerComplaints($db, $user['username']),
            'notifications' => ComplaintService::getNotifications($db, $user['username']),
        ]);
    }

    public static function handleConfirmLocation(PDO $db): void
    {
        requireMethod('POST');
        $user = AuthService::requireRole($db, 'customer');
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

    public static function handleSubmitComplaint(PDO $db): void
    {
        requireMethod('POST');
        $user = AuthService::requireRole($db, 'customer');
        $location = $_SESSION['confirmed_location'] ?? '';
        if (!is_string($location) || $location === '' || $location !== $user['service_area']) {
            respond(403, ['error' => 'Confirm your registered service location before submitting a complaint.']);
        }
        $request = readJsonBody();
        $category = requiredText($request, 'category', 80);
        $description = requiredText($request, 'description', 1000);
        $complaintId = ComplaintService::insertComplaint($db, $user['username'], $category, $description, $location);
        $admins = $db->query('SELECT username FROM users WHERE role = "admin"')->fetchAll();
        foreach ($admins as $admin) {
            ComplaintService::notify($db, $admin['username'], 'new_complaint', 'New customer complaint #' . $complaintId . ' is ready for review.');
        }
        unset($_SESSION['confirmed_location']);
        respond(201, ['complaint_id' => $complaintId, 'status' => 'OPEN', 'message' => 'Your demo complaint was submitted to the admin queue.']);
    }
}
