<?php
/**
 * Events API
 * Handles: GET (list/filter/single), POST (create), PUT (update), DELETE
 * All responses are JSON. Mutations require an active session.
 */

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = getDBConnection();

/**
 * Helper: require an authenticated session.
 */
function requireAuth(): int
{
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required.']);
        exit;
    }
    return (int) $_SESSION['user_id'];
}

// ─────────────────────────────────────────────────────────────
// GET - List events (with optional filters) or single event
// ─────────────────────────────────────────────────────────────
if ($method === 'GET') {

    // Single event by id
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare('
            SELECT e.*, u.full_name AS creator_name
            FROM events e
            JOIN users u ON u.id = e.creator_id
            WHERE e.id = ?
        ');
        $stmt->execute([(int) $_GET['id']]);
        $event = $stmt->fetch();

        if (!$event) {
            http_response_code(404);
            echo json_encode(['error' => 'Event not found.']);
            exit;
        }

        echo json_encode($event);
        exit;
    }

    // Build dynamic WHERE clause for filters
    $where  = [];
    $params = [];

    // Search by title or description
    if (!empty($_GET['search'])) {
        $where[]  = '(e.title LIKE ? OR e.description LIKE ?)';
        $term     = '%' . $_GET['search'] . '%';
        $params[] = $term;
        $params[] = $term;
    }

    // Filter by event_type
    if (!empty($_GET['type'])) {
        $where[]  = 'e.event_type = ?';
        $params[] = $_GET['type'];
    }

    // Filter by date range
    if (!empty($_GET['date_from'])) {
        $where[]  = 'e.event_date >= ?';
        $params[] = $_GET['date_from'];
    }
    if (!empty($_GET['date_to'])) {
        $where[]  = 'e.event_date <= ?';
        $params[] = $_GET['date_to'] . ' 23:59:59';
    }

    // Upcoming events only (default if no date filters)
    if (!empty($_GET['upcoming'])) {
        $where[]  = 'e.event_date >= NOW()';
    }

    // Filter by creator (for dashboard "my events")
    if (!empty($_GET['creator_id'])) {
        $where[]  = 'e.creator_id = ?';
        $params[] = (int) $_GET['creator_id'];
    }

    $sql = '
        SELECT e.*, u.full_name AS creator_name
        FROM events e
        JOIN users u ON u.id = e.creator_id
    ';

    if (!empty($where)) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    $sql .= ' ORDER BY e.event_date ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $events = $stmt->fetchAll();

    echo json_encode($events);
    exit;
}

// ─────────────────────────────────────────────────────────────
// POST - Create a new event
// ─────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $userId = requireAuth();
    $data   = json_decode(file_get_contents('php://input'), true);

    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    $eventDate   = trim($data['event_date'] ?? '');
    $eventType   = trim($data['event_type'] ?? '');
    $totalSeats  = (int) ($data['total_seats'] ?? 0);

    // Validate
    if ($title === '' || $eventDate === '' || $eventType === '' || $totalSeats < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Title, date, type, and seats (≥1) are required.']);
        exit;
    }

    $stmt = $pdo->prepare('
        INSERT INTO events (creator_id, title, description, event_date, event_type, total_seats, available_seats)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$userId, $title, $description, $eventDate, $eventType, $totalSeats, $totalSeats]);

    $newId = (int) $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'event'   => [
            'id'              => $newId,
            'creator_id'      => $userId,
            'title'           => $title,
            'description'     => $description,
            'event_date'      => $eventDate,
            'event_type'      => $eventType,
            'total_seats'     => $totalSeats,
            'available_seats' => $totalSeats,
        ],
    ]);
    exit;
}

// ─────────────────────────────────────────────────────────────
// PUT - Update an existing event (only by its creator)
// ─────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $userId = requireAuth();
    $data   = json_decode(file_get_contents('php://input'), true);

    $eventId     = (int) ($data['id'] ?? 0);
    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    $eventDate   = trim($data['event_date'] ?? '');
    $eventType   = trim($data['event_type'] ?? '');
    $totalSeats  = (int) ($data['total_seats'] ?? 0);

    if ($eventId < 1 || $title === '' || $eventDate === '' || $eventType === '' || $totalSeats < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required for an update.']);
        exit;
    }

    // Verify ownership
    $stmt = $pdo->prepare('SELECT creator_id, total_seats, available_seats FROM events WHERE id = ?');
    $stmt->execute([$eventId]);
    $event = $stmt->fetch();

    if (!$event) {
        http_response_code(404);
        echo json_encode(['error' => 'Event not found.']);
        exit;
    }

    if ((int) $event['creator_id'] !== $userId) {
        http_response_code(403);
        echo json_encode(['error' => 'You can only edit your own events.']);
        exit;
    }

    // Recalculate available seats proportionally
    $bookedSeats    = (int) $event['total_seats'] - (int) $event['available_seats'];
    $newAvailable   = max(0, $totalSeats - $bookedSeats);

    $stmt = $pdo->prepare('
        UPDATE events
        SET title = ?, description = ?, event_date = ?, event_type = ?, total_seats = ?, available_seats = ?
        WHERE id = ?
    ');
    $stmt->execute([$title, $description, $eventDate, $eventType, $totalSeats, $newAvailable, $eventId]);

    echo json_encode(['success' => true]);
    exit;
}

// ─────────────────────────────────────────────────────────────
// DELETE - Remove an event (only by its creator)
// ─────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $userId = requireAuth();

    // Read event id from query string or body
    $eventId = (int) ($_GET['id'] ?? 0);
    if ($eventId < 1) {
        $data    = json_decode(file_get_contents('php://input'), true);
        $eventId = (int) ($data['id'] ?? 0);
    }

    if ($eventId < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Event ID is required.']);
        exit;
    }

    // Verify ownership
    $stmt = $pdo->prepare('SELECT creator_id FROM events WHERE id = ?');
    $stmt->execute([$eventId]);
    $event = $stmt->fetch();

    if (!$event) {
        http_response_code(404);
        echo json_encode(['error' => 'Event not found.']);
        exit;
    }

    if ((int) $event['creator_id'] !== $userId) {
        http_response_code(403);
        echo json_encode(['error' => 'You can only delete your own events.']);
        exit;
    }

    $stmt = $pdo->prepare('DELETE FROM events WHERE id = ?');
    $stmt->execute([$eventId]);

    echo json_encode(['success' => true]);
    exit;
}

// Unsupported method
http_response_code(405);
echo json_encode(['error' => 'Method not allowed.']);
