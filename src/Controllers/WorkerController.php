<?php
declare(strict_types=1);

class WorkerController
{
    public static function handleTasks(PDO $db): void
    {
        requireMethod('GET');
        $worker = AuthService::requireRole($db, 'worker');
        $query = $db->prepare(
            'SELECT c.complaint_id, c.category, c.description, c.location, c.status,
                    c.worker_note, c.created_at, c.updated_at, u.full_name AS customer_name
             FROM complaints c JOIN users u ON u.username = c.customer_username
             WHERE c.assigned_worker = :worker ORDER BY c.complaint_id DESC'
        );
        $query->execute(['worker' => $worker['username']]);
        respond(200, ['user' => AuthService::safeUser($worker), 'tasks' => $query->fetchAll()]);
    }

    public static function handleTaskUpdate(PDO $db): void
    {
        requireMethod('POST');
        $worker = AuthService::requireRole($db, 'worker');
        $request = readJsonBody();
        $complaintId = filter_var($request['complaint_id'] ?? null, FILTER_VALIDATE_INT);
        $status = $request['status'] ?? '';
        if (!is_string($status) || !in_array($status, ['IN_PROGRESS', 'BLOCKED', 'RESOLVED'], true)) {
            respond(422, ['error' => 'Choose a valid work status.']);
        }
        $note = requiredText($request, 'note', 1000);
        if ($complaintId === false || $complaintId < 1) {
            respond(422, ['error' => 'A valid complaint_id is required.']);
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
            ComplaintService::notify($db, $admin['username'], 'worker_update', $message);
        }
        ComplaintService::notify($db, $case['customer_username'], 'case_update', $message);
        respond(200, ['ok' => true]);
    }
}
