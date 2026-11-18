<?php
declare(strict_types=1);

class AdminController
{
    public static function handleOverview(PDO $db): void
    {
        requireMethod('GET');
        AuthService::requireRole($db, 'admin');
        $complaints = ComplaintService::getAdminComplaints($db);
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
        $notifications = ComplaintService::getNotifications($db, 'admin');
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

    public static function handleCreateWorker(PDO $db): void
    {
        requireMethod('POST');
        AuthService::requireRole($db, 'admin');
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
        if (AuthService::findUser($db, $username) !== null) {
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
        $worker = AuthService::findUser($db, $username);
        if ($worker === null) {
            respond(500, ['error' => 'Worker account was created but could not be loaded.']);
        }
        respond(201, ['worker' => AuthService::safeUser($worker)]);
    }

    public static function handleWorkerStatus(PDO $db): void
    {
        requireMethod('POST');
        AuthService::requireRole($db, 'admin');
        $request = readJsonBody();
        $username = requiredText($request, 'username', 64);
        $active = $request['active'] ?? null;
        if (!is_bool($active)) {
            respond(422, ['error' => 'Choose whether worker access should be active.']);
        }
        $worker = AuthService::findUser($db, $username);
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

    public static function handleComplaintAction(PDO $db): void
    {
        requireMethod('POST');
        AuthService::requireRole($db, 'admin');
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
            $worker = AuthService::findUser($db, $workerUsername);
            if ($worker === null || $worker['role'] !== 'worker' || $worker['account_status'] !== 'active') {
                respond(422, ['error' => 'Choose an active demo worker.']);
            }
            $status = $case['status'] === 'OPEN' ? 'ASSIGNED' : $case['status'];
            $db->prepare(
                'UPDATE complaints SET assigned_worker = :worker, status = :status, updated_at = :updated
                 WHERE complaint_id = :id'
            )->execute(['worker' => $workerUsername, 'status' => $status, 'updated' => $now, 'id' => $complaintId]);
            ComplaintService::notify($db, $workerUsername, 'assignment', 'Complaint #' . $complaintId . ' was assigned to you.');
            ComplaintService::notify($db, $case['customer_username'], 'case_update', 'A field worker was assigned to complaint #' . $complaintId . '.');
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
            ComplaintService::notify($db, $case['customer_username'], 'case_update', 'Admin updated complaint #' . $complaintId . ' to ' . $status . '.');
        } elseif ($action === 'penalty_review') {
            $db->prepare('UPDATE complaints SET penalty_review = 1, updated_at = :updated WHERE complaint_id = :id')
                ->execute(['updated' => $now, 'id' => $complaintId]);
            ComplaintService::notify($db, 'admin', 'penalty_review', 'Complaint #' . $complaintId . ' was flagged for a human penalty review.');
        } else {
            respond(422, ['error' => 'Unsupported admin action.']);
        }

        respond(200, ['ok' => true]);
    }

    public static function handleCustomerNotice(PDO $db): void
    {
        requireMethod('POST');
        AuthService::requireRole($db, 'admin');
        $request = readJsonBody();
        $customerUsername = requiredText($request, 'customer_username', 64);
        $channel = $request['channel'] ?? '';
        if (!is_string($channel) || !in_array($channel, ['email', 'sms', 'call'], true)) {
            respond(422, ['error' => 'Choose email, SMS, or call.']);
        }
        $customer = AuthService::findUser($db, $customerUsername);
        if ($customer === null || $customer['role'] !== 'customer') {
            respond(404, ['error' => 'Customer account not found.']);
        }
        ComplaintService::notify(
            $db,
            $customerUsername,
            'removal_notice',
            'Demo service review notice: an administrator requested a conversation before any account or service change. This is not a disconnection.',
            $channel
        );
        respond(200, ['ok' => true, 'message' => 'Demo notice recorded. No email, SMS, or call was sent.']);
    }

    public static function handleRequestRemoval(PDO $db): void
    {
        requireMethod('POST');
        AuthService::requireRole($db, 'admin');
        $request = readJsonBody();
        $customerUsername = requiredText($request, 'customer_username', 64);
        $customer = AuthService::findUser($db, $customerUsername);
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
        ComplaintService::notify($db, $customerUsername, 'removal_review', 'An account-removal request is pending human review. Your service has not been disconnected.');
        respond(200, ['ok' => true, 'account_status' => 'pending_removal']);
    }
}
