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

$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
$isJson = (strpos(strtolower($contentType), 'application/json') !== false);

if ($method === 'POST' && !$isJson && isset($_POST['_method'])) {
    $overrideMethod = strtoupper($_POST['_method']);
    if ($overrideMethod === 'PUT' || $overrideMethod === 'DELETE') {
        $method = $overrideMethod;
    }
}

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

/**
 * Validate and save uploaded image.
 * Returns relative path on success, or exits with error response.
 */
function handleImageUpload(): ?string
{
    if (!isset($_FILES['event_image']) || $_FILES['event_image']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES['event_image'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'File upload error code: ' . $file['error']]);
        exit;
    }

    // Check size (5MB max)
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'File size exceeds 5MB limit.']);
        exit;
    }

    // Check extension
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($extension, $allowedExts)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file extension. Only JPG, JPEG, PNG, and WEBP are allowed.']);
        exit;
    }

    // Check MIME type using mime_content_type
    $mimeType = mime_content_type($file['tmp_name']);
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mimeType, $allowedMimes)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.']);
        exit;
    }

    // Create uploads folder if not exists
    $uploadDir = __DIR__ . '/../uploads';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create uploads directory.']);
            exit;
        }
    }

    // Generate unique safe name
    try {
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
    } catch (Exception $e) {
        $filename = uniqid('img_', true) . '.' . $extension;
    }

    // Ensure we don't have directory traversal in the name
    $filename = basename($filename);
    $targetPath = $uploadDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save uploaded file.']);
        exit;
    }

    return 'uploads/' . $filename;
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
    
    if ($isJson) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    $eventDate   = trim($data['event_date'] ?? '');
    $endTime     = trim($data['end_time'] ?? '');
    $eventType   = trim($data['event_type'] ?? '');
    $location    = trim($data['location'] ?? 'Online');
    $ticketPrice = (float) ($data['ticket_price'] ?? 0);
    $totalSeats  = (int) ($data['total_seats'] ?? 0);

    if ($title === '' || $eventDate === '' || $endTime === '' || $eventType === '' || $totalSeats < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Title, start date, end date, type, and seats (≥1) are required.']);
        exit;
    }

    if (strtotime($endTime) <= strtotime($eventDate)) {
        http_response_code(400);
        echo json_encode(['error' => 'End time must be after the start time.']);
        exit;
    }

    // Process image upload
    $imagePath = handleImageUpload();

    $stmt = $mysqli->prepare('
        INSERT INTO events (creator_id, title, description, event_date, end_time, event_type, location, ticket_price, total_seats, available_seats, image_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->bind_param('issssssdiis', $userId, $title, $description, $eventDate, $endTime, $eventType, $location, $ticketPrice, $totalSeats, $totalSeats, $imagePath);
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
            'end_time'        => $endTime,
            'event_type'      => $eventType,
            'location'        => $location,
            'ticket_price'    => $ticketPrice,
            'total_seats'     => $totalSeats,
            'available_seats' => $totalSeats,
            'image_path'      => $imagePath,
        ],
    ]);
    exit;
}

// PUT - Update an existing event (only by its creator)
if ($method === 'PUT') {
    $userId = requireAuth();
    
    if ($isJson) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    $eventId     = (int) ($data['id'] ?? 0);
    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    $eventDate   = trim($data['event_date'] ?? '');
    $endTime     = trim($data['end_time'] ?? '');
    $eventType   = trim($data['event_type'] ?? '');
    $location    = trim($data['location'] ?? 'Online');
    $ticketPrice = (float) ($data['ticket_price'] ?? 0);
    $totalSeats  = (int) ($data['total_seats'] ?? 0);

    if ($eventId < 1 || $title === '' || $eventDate === '' || $endTime === '' || $eventType === '' || $totalSeats < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields (including end time) are required for an update.']);
        exit;
    }

    if (strtotime($endTime) <= strtotime($eventDate)) {
        http_response_code(400);
        echo json_encode(['error' => 'End time must be after the start time.']);
        exit;
    }

    // Verify ownership and get current image_path
    $stmt = $mysqli->prepare('SELECT creator_id, total_seats, available_seats, image_path FROM events WHERE id = ?');
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

    // Process image upload
    $imagePath = $event['image_path'];
    $newUploadedPath = handleImageUpload();
    if ($newUploadedPath !== null) {
        $imagePath = $newUploadedPath;
        // Clean up old image if there was one
        if (!empty($event['image_path'])) {
            $oldFile = __DIR__ . '/../' . $event['image_path'];
            if (file_exists($oldFile) && is_file($oldFile)) {
                @unlink($oldFile);
            }
        }
    }

    // Recalculate available seats proportionally
    $bookedSeats    = (int) $event['total_seats'] - (int) $event['available_seats'];
    $newAvailable   = max(0, $totalSeats - $bookedSeats);

    $stmt = $mysqli->prepare('
        UPDATE events
        SET title = ?, description = ?, event_date = ?, end_time = ?, event_type = ?, location = ?, ticket_price = ?, total_seats = ?, available_seats = ?, image_path = ?
        WHERE id = ?
    ');
    $stmt->bind_param('ssssssdiiisi', $title, $description, $eventDate, $endTime, $eventType, $location, $ticketPrice, $totalSeats, $newAvailable, $imagePath, $eventId);
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
