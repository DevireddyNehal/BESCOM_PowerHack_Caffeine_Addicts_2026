<?php
declare(strict_types=1);

class ComplaintService
{
    public static function notify(PDO $db, string $recipient, string $kind, string $message, string $channel = 'in-app'): void
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

    public static function getNotifications(PDO $db, string $username): array
    {
        $query = $db->prepare(
            'SELECT notification_id, kind, message, channel, created_at
             FROM notifications WHERE recipient_username = :username
             ORDER BY notification_id DESC LIMIT 50'
        );
        $query->execute(['username' => $username]);
        return $query->fetchAll();
    }

    public static function getCustomerComplaints(PDO $db, string $username): array
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

    public static function getAdminComplaints(PDO $db): array
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

    public static function insertComplaint(PDO $db, string $customer, string $category, string $description, string $location): int
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
}
