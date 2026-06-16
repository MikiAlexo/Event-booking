<?php
/**
 * Events API
 * Handles: GET (list/filter/single), POST (create), PUT (update), DELETE
 * Also handles saved events (action=save, action=unsave, action=saved)
 * All responses are JSON. Mutations require an active session.
 */

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$mysqli = getDBConnection();

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

// ─────────────────────────────────────────────────────────
// Handle "saved" actions
// ─────────────────────────────────────────────────────────
if ($action === 'save') {
    if ($method !== 'POST') { http_response_code(405); exit; }
    $userId = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $eventId = (int) ($data['event_id'] ?? 0);
    
    if ($eventId < 1) { http_response_code(400); echo json_encode(['error' => 'Valid event ID required.']); exit; }
    
    $stmt = $mysqli->prepare('INSERT IGNORE INTO saved_events (user_id, event_id) VALUES (?, ?)');
    $stmt->bind_param('ii', $userId, $eventId);
    $stmt->execute();
    
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'unsave') {
    if ($method !== 'POST') { http_response_code(405); exit; }
    $userId = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $eventId = (int) ($data['event_id'] ?? 0);
    
    if ($eventId < 1) { http_response_code(400); echo json_encode(['error' => 'Valid event ID required.']); exit; }
    
    $stmt = $mysqli->prepare('DELETE FROM saved_events WHERE user_id = ? AND event_id = ?');
    $stmt->bind_param('ii', $userId, $eventId);
    $stmt->execute();
    
    echo json_encode(['success' => true]);
    exit;
}

// GET - List events (with optional filters) or single event
if ($method === 'GET') {
    
    // Support returning saved events only
    if ($action === 'saved') {
        $userId = requireAuth();
        $stmt = $mysqli->prepare('
            SELECT e.*, u.full_name AS creator_name
            FROM events e
            JOIN saved_events se ON se.event_id = e.id
            JOIN users u ON u.id = e.creator_id
            WHERE se.user_id = ?
            ORDER BY e.event_date ASC
        ');
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        exit;
    }

    // Single event by id
    if (isset($_GET['id'])) {
        $stmt = $mysqli->prepare('
            SELECT e.*, u.full_name AS creator_name
            FROM events e
            JOIN users u ON u.id = e.creator_id
            WHERE e.id = ?
        ');
        $id = (int)$_GET['id'];
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $event = $result->fetch_assoc();

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
    $types  = '';

    if (!empty($_GET['search'])) {
        $where[]  = '(e.title LIKE ? OR e.description LIKE ?)';
        $term     = '%' . $_GET['search'] . '%';
        $params[] = $term;
        $params[] = $term;
        $types .= 'ss';
    }

    if (!empty($_GET['type'])) {
        $where[]  = 'e.event_type = ?';
        $params[] = $_GET['type'];
        $types .= 's';
    }
    
    if (!empty($_GET['location'])) {
        $where[]  = 'e.location LIKE ?';
        $params[] = '%' . $_GET['location'] . '%';
        $types .= 's';
    }

    if (!empty($_GET['date_from'])) {
        $where[]  = 'e.event_date >= ?';
        $params[] = $_GET['date_from'];
        $types .= 's';
    }
    
    if (!empty($_GET['date_to'])) {
        $where[]  = 'e.event_date <= ?';
        $params[] = $_GET['date_to'] . ' 23:59:59';
        $types .= 's';
    }

    if (!empty($_GET['upcoming'])) {
        $where[]  = 'e.event_date >= NOW()';
    }

    if (!empty($_GET['creator_id'])) {
        $where[]  = 'e.creator_id = ?';
        $params[] = (int) $_GET['creator_id'];
        $types .= 'i';
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

    $stmt = $mysqli->prepare($sql);
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $events = $result->fetch_all(MYSQLI_ASSOC);

    echo json_encode($events);
    exit;
}

// POST - Create a new event
if ($method === 'POST') {
    $userId = requireAuth();
    $data   = json_decode(file_get_contents('php://input'), true);

    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    $eventDate   = trim($data['event_date'] ?? '');
    $eventType   = trim($data['event_type'] ?? '');
    $location    = trim($data['location'] ?? 'Online');
    $ticketPrice = (float) ($data['ticket_price'] ?? 0);
    $totalSeats  = (int) ($data['total_seats'] ?? 0);

    if ($title === '' || $eventDate === '' || $eventType === '' || $totalSeats < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Title, date, type, and seats (≥1) are required.']);
        exit;
    }

    $stmt = $mysqli->prepare('
        INSERT INTO events (creator_id, title, description, event_date, event_type, location, ticket_price, total_seats, available_seats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->bind_param('isssssdii', $userId, $title, $description, $eventDate, $eventType, $location, $ticketPrice, $totalSeats, $totalSeats);
    $stmt->execute();

    $newId = (int) $mysqli->insert_id;

    echo json_encode([
        'success' => true,
        'event'   => [
            'id'              => $newId,
            'creator_id'      => $userId,
            'title'           => $title,
            'description'     => $description,
            'event_date'      => $eventDate,
            'event_type'      => $eventType,
            'location'        => $location,
            'ticket_price'    => $ticketPrice,
            'total_seats'     => $totalSeats,
            'available_seats' => $totalSeats,
        ],
    ]);
    exit;
}

// PUT - Update an existing event (only by its creator)
if ($method === 'PUT') {
    $userId = requireAuth();
    $data   = json_decode(file_get_contents('php://input'), true);

    $eventId     = (int) ($data['id'] ?? 0);
    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    $eventDate   = trim($data['event_date'] ?? '');
    $eventType   = trim($data['event_type'] ?? '');
    $location    = trim($data['location'] ?? 'Online');
    $ticketPrice = (float) ($data['ticket_price'] ?? 0);
    $totalSeats  = (int) ($data['total_seats'] ?? 0);

    if ($eventId < 1 || $title === '' || $eventDate === '' || $eventType === '' || $totalSeats < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required for an update.']);
        exit;
    }

    // Verify ownership
    $stmt = $mysqli->prepare('SELECT creator_id, total_seats, available_seats FROM events WHERE id = ?');
    $stmt->bind_param('i', $eventId);
    $stmt->execute();
    $result = $stmt->get_result();
    $event = $result->fetch_assoc();

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

    $stmt = $mysqli->prepare('
        UPDATE events
        SET title = ?, description = ?, event_date = ?, event_type = ?, location = ?, ticket_price = ?, total_seats = ?, available_seats = ?
        WHERE id = ?
    ');
    $stmt->bind_param('sssssdiii', $title, $description, $eventDate, $eventType, $location, $ticketPrice, $totalSeats, $newAvailable, $eventId);
    $stmt->execute();

    echo json_encode(['success' => true]);
    exit;
}

// DELETE - Remove an event (only by its creator)
if ($method === 'DELETE') {
    $userId = requireAuth();

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
    $stmt = $mysqli->prepare('SELECT creator_id FROM events WHERE id = ?');
    $stmt->bind_param('i', $eventId);
    $stmt->execute();
    $result = $stmt->get_result();
    $event = $result->fetch_assoc();

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

    $stmt = $mysqli->prepare('DELETE FROM events WHERE id = ?');
    $stmt->bind_param('i', $eventId);
    $stmt->execute();

    echo json_encode(['success' => true]);
    exit;
}

// Unsupported method
http_response_code(405);
echo json_encode(['error' => 'Method not allowed.']);
