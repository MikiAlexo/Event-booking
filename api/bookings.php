<?php
/**
 * Bookings API
 * Handles: book (with transactional overbooking protection), cancel, list user bookings.
 * All responses are JSON.
 */

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$pdo    = getDBConnection();

/**
 * Require authenticated session and return user ID.
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

switch ($action) {

    // ─────────────────────────────────────────────────────────
    // BOOK - Create a booking with concurrency-safe transaction
    // ─────────────────────────────────────────────────────────
    case 'book':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        $userId = requireAuth();
        $data   = json_decode(file_get_contents('php://input'), true);
        $eventId = (int) ($data['event_id'] ?? 0);

        if ($eventId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid event ID is required.']);
            exit;
        }

        // Check for existing active booking by this user for this event
        $checkStmt = $pdo->prepare('SELECT id FROM bookings WHERE user_id = ? AND event_id = ? AND status = ?');
        $checkStmt->execute([$userId, $eventId, 'active']);
        if ($checkStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'You have already booked this event.']);
            exit;
        }

        // ── BEGIN TRANSACTION ──
        $pdo->beginTransaction();

        try {
            // Step 1: Lock the event row and read available seats
            $stmt = $pdo->prepare('SELECT available_seats, total_seats FROM events WHERE id = ? FOR UPDATE');
            $stmt->execute([$eventId]);
            $event = $stmt->fetch();

            if (!$event) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Event not found.']);
                exit;
            }

            // Step 2: Check seat availability
            if ((int) $event['available_seats'] <= 0) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'This event is fully booked. No seats available.']);
                exit;
            }

            // Step 3: Decrement available seats
            $updateStmt = $pdo->prepare('UPDATE events SET available_seats = available_seats - 1 WHERE id = ?');
            $updateStmt->execute([$eventId]);

            // Step 4: Insert booking record
            $insertStmt = $pdo->prepare('INSERT INTO bookings (user_id, event_id, status) VALUES (?, ?, ?)');
            $insertStmt->execute([$userId, $eventId, 'active']);

            $bookingId = (int) $pdo->lastInsertId();

            // Step 5: Commit transaction
            $pdo->commit();

            echo json_encode([
                'success' => true,
                'booking' => [
                    'id'       => $bookingId,
                    'user_id'  => $userId,
                    'event_id' => $eventId,
                    'status'   => 'active',
                ],
            ]);

        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Booking failed due to a server error. Please try again.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // CANCEL - Cancel an active booking and restore the seat
    // ─────────────────────────────────────────────────────────
    case 'cancel':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        $userId    = requireAuth();
        $data      = json_decode(file_get_contents('php://input'), true);
        $bookingId = (int) ($data['booking_id'] ?? 0);

        if ($bookingId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid booking ID is required.']);
            exit;
        }

        // Fetch the booking to verify ownership and status
        $stmt = $pdo->prepare('SELECT id, user_id, event_id, status FROM bookings WHERE id = ?');
        $stmt->execute([$bookingId]);
        $booking = $stmt->fetch();

        if (!$booking) {
            http_response_code(404);
            echo json_encode(['error' => 'Booking not found.']);
            exit;
        }

        if ((int) $booking['user_id'] !== $userId) {
            http_response_code(403);
            echo json_encode(['error' => 'You can only cancel your own bookings.']);
            exit;
        }

        if ($booking['status'] === 'cancelled') {
            http_response_code(400);
            echo json_encode(['error' => 'This booking is already cancelled.']);
            exit;
        }

        // Transaction: mark cancelled + restore seat
        $pdo->beginTransaction();

        try {
            $updateBooking = $pdo->prepare('UPDATE bookings SET status = ? WHERE id = ?');
            $updateBooking->execute(['cancelled', $bookingId]);

            $restoreSeat = $pdo->prepare('UPDATE events SET available_seats = available_seats + 1 WHERE id = ?');
            $restoreSeat->execute([(int) $booking['event_id']]);

            $pdo->commit();

            echo json_encode(['success' => true]);

        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Cancellation failed. Please try again.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // LIST - Get all bookings for the authenticated user
    // ─────────────────────────────────────────────────────────
    case 'list':
        if ($method !== 'GET') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            exit;
        }

        $userId = requireAuth();

        $stmt = $pdo->prepare('
            SELECT b.id AS booking_id, b.booking_date, b.status,
                   e.id AS event_id, e.title, e.event_date, e.event_type,
                   e.total_seats, e.available_seats
            FROM bookings b
            JOIN events e ON e.id = b.event_id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC
        ');
        $stmt->execute([$userId]);
        $bookings = $stmt->fetchAll();

        echo json_encode($bookings);
        break;

    // ─── Unknown Action ─────────────────────────────────────
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Use: book, cancel, list.']);
        break;
}
