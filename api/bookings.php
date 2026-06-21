<?php
/**
 * Bookings API
 * Handles: book, cancel, list, check_in, attendees
 * Uses MySQLi with transaction safety.
 */

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$mysqli = getDBConnection();

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
    // BOOK - Create booking, deduct balance, or join waitlist
    // ─────────────────────────────────────────────────────────
    case 'book':
        if ($method !== 'POST') { http_response_code(405); exit; }

        $userId = requireAuth();
        $data   = json_decode(file_get_contents('php://input'), true);
        $eventId = (int) ($data['event_id'] ?? 0);

        if ($eventId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid event ID is required.']);
            exit;
        }

        // Check for existing active booking
        $checkStmt = $mysqli->prepare("SELECT id FROM bookings WHERE user_id = ? AND event_id = ? AND status = 'active'");
        $checkStmt->bind_param('ii', $userId, $eventId);
        $checkStmt->execute();
        $res = $checkStmt->get_result();
        if ($res->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'You have already booked this event.']);
            exit;
        }

        // Check if already in waitlist
        $waitStmt = $mysqli->prepare("SELECT id FROM waitlist WHERE user_id = ? AND event_id = ?");
        $waitStmt->bind_param('ii', $userId, $eventId);
        $waitStmt->execute();
        $wres = $waitStmt->get_result();
        if ($wres->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'You are already on the waitlist for this event.']);
            exit;
        }

        $mysqli->begin_transaction();

        try {
            // Lock the event and user rows
            $stmt = $mysqli->prepare('SELECT available_seats, total_seats, ticket_price FROM events WHERE id = ? FOR UPDATE');
            $stmt->bind_param('i', $eventId);
            $stmt->execute();
            $evRes = $stmt->get_result();
            $event = $evRes->fetch_assoc();

            if (!$event) {
                $mysqli->rollback();
                http_response_code(404);
                echo json_encode(['error' => 'Event not found.']);
                exit;
            }

            $ticketPrice = (float) $event['ticket_price'];

            // Check user balance
            $uStmt = $mysqli->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
            $uStmt->bind_param('i', $userId);
            $uStmt->execute();
            $uRes = $uStmt->get_result();
            $user = $uRes->fetch_assoc();

            $balance = (float) $user['balance'];

            if ($balance < $ticketPrice) {
                $mysqli->rollback();
                http_response_code(400);
                echo json_encode(['error' => 'Insufficient Birr balance.']);
                exit;
            }

            // Check seats
            if ((int) $event['available_seats'] <= 0) {
                // Join Waitlist instead of booking
                $wInsert = $mysqli->prepare('INSERT INTO waitlist (user_id, event_id) VALUES (?, ?)');
                $wInsert->bind_param('ii', $userId, $eventId);
                $wInsert->execute();
                
                $mysqli->commit();
                echo json_encode(['success' => true, 'waitlist' => true, 'message' => 'Event is full. You have been added to the waitlist.']);
                exit;
            }

            // Deduct balance and seats, then book
            $newBalance = $balance - $ticketPrice;
            $updUser = $mysqli->prepare('UPDATE users SET balance = ? WHERE id = ?');
            $updUser->bind_param('di', $newBalance, $userId);
            $updUser->execute();

            $updEvent = $mysqli->prepare('UPDATE events SET available_seats = available_seats - 1 WHERE id = ?');
            $updEvent->bind_param('i', $eventId);
            $updEvent->execute();

            $insBooking = $mysqli->prepare("INSERT INTO bookings (user_id, event_id, status) VALUES (?, ?, 'active')");
            $insBooking->bind_param('ii', $userId, $eventId);
            $insBooking->execute();
            $bookingId = (int) $mysqli->insert_id;

            $mysqli->commit();
            
            $_SESSION['user_balance'] = $newBalance;

            echo json_encode([
                'success' => true,
                'booking' => [
                    'id'       => $bookingId,
                    'user_id'  => $userId,
                    'event_id' => $eventId,
                    'status'   => 'active',
                ],
                'new_balance' => $newBalance
            ]);

        } catch (Exception $e) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['error' => 'Booking failed due to server error.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // CANCEL - Cancel booking, refund, auto-promote waitlist
    // ─────────────────────────────────────────────────────────
    case 'cancel':
        if ($method !== 'POST') { http_response_code(405); exit; }

        $userId = requireAuth();
        $data   = json_decode(file_get_contents('php://input'), true);
        $bookingId = (int) ($data['booking_id'] ?? 0);

        if ($bookingId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid booking ID is required.']);
            exit;
        }

        $mysqli->begin_transaction();

        try {
            // Lock booking
            $stmt = $mysqli->prepare('SELECT id, user_id, event_id, status FROM bookings WHERE id = ? FOR UPDATE');
            $stmt->bind_param('i', $bookingId);
            $stmt->execute();
            $res = $stmt->get_result();
            $booking = $res->fetch_assoc();

            if (!$booking) {
                $mysqli->rollback();
                http_response_code(404);
                echo json_encode(['error' => 'Booking not found.']);
                exit;
            }

            if ((int) $booking['user_id'] !== $userId) {
                $mysqli->rollback();
                http_response_code(403);
                echo json_encode(['error' => 'You can only cancel your own bookings.']);
                exit;
            }

            if ($booking['status'] === 'cancelled') {
                $mysqli->rollback();
                http_response_code(400);
                echo json_encode(['error' => 'This booking is already cancelled.']);
                exit;
            }

            $eventId = (int) $booking['event_id'];

            // Lock event to get price
            $eStmt = $mysqli->prepare('SELECT ticket_price FROM events WHERE id = ? FOR UPDATE');
            $eStmt->bind_param('i', $eventId);
            $eStmt->execute();
            $eRes = $eStmt->get_result();
            $event = $eRes->fetch_assoc();
            $ticketPrice = (float) $event['ticket_price'];

            // Mark cancelled
            $updBooking = $mysqli->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?");
            $updBooking->bind_param('i', $bookingId);
            $updBooking->execute();

            // Refund user
            $updUser = $mysqli->prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
            $updUser->bind_param('di', $ticketPrice, $userId);
            $updUser->execute();

            // Check waitlist
            $wStmt = $mysqli->prepare('SELECT id, user_id FROM waitlist WHERE event_id = ? ORDER BY joined_at ASC');
            $wStmt->bind_param('i', $eventId);
            $wStmt->execute();
            $wRes = $wStmt->get_result();
            
            $seatFilled = false;
            while ($waitUser = $wRes->fetch_assoc()) {
                $wUserId = (int)$waitUser['user_id'];
                
                // Check waitlist user balance
                $wuStmt = $mysqli->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
                $wuStmt->bind_param('i', $wUserId);
                $wuStmt->execute();
                $wuRes = $wuStmt->get_result();
                $wUserObj = $wuRes->fetch_assoc();
                
                if ($wUserObj && (float)$wUserObj['balance'] >= $ticketPrice) {
                    // Promote this user
                    $nBalance = (float)$wUserObj['balance'] - $ticketPrice;
                    $updWu = $mysqli->prepare('UPDATE users SET balance = ? WHERE id = ?');
                    $updWu->bind_param('di', $nBalance, $wUserId);
                    $updWu->execute();
                    
                    // Add booking
                    $insWBooking = $mysqli->prepare("INSERT INTO bookings (user_id, event_id, status) VALUES (?, ?, 'active')");
                    $insWBooking->bind_param('ii', $wUserId, $eventId);
                    $insWBooking->execute();
                    
                    // Remove from waitlist
                    $delW = $mysqli->prepare('DELETE FROM waitlist WHERE id = ?');
                    $delW->bind_param('i', $waitUser['id']);
                    $delW->execute();
                    
                    $seatFilled = true;
                    break;
                }
            }

            if (!$seatFilled) {
                // Restore seat if no one from waitlist could take it
                $restoreSeat = $mysqli->prepare('UPDATE events SET available_seats = available_seats + 1 WHERE id = ?');
                $restoreSeat->bind_param('i', $eventId);
                $restoreSeat->execute();
            }

            $mysqli->commit();

            // Re-fetch current user balance for frontend
            $cuStmt = $mysqli->prepare('SELECT balance FROM users WHERE id = ?');
            $cuStmt->bind_param('i', $userId);
            $cuStmt->execute();
            $cuRes = $cuStmt->get_result();
            $cuObj = $cuRes->fetch_assoc();
            $_SESSION['user_balance'] = (float)$cuObj['balance'];

            echo json_encode(['success' => true, 'new_balance' => $_SESSION['user_balance']]);

        } catch (Exception $e) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['error' => 'Cancellation failed.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // LIST - Get bookings and waitlist for user
    // ─────────────────────────────────────────────────────────
    case 'list':
        if ($method !== 'GET') { http_response_code(405); exit; }
        $userId = requireAuth();

        $stmt = $mysqli->prepare('
            SELECT b.id AS booking_id, b.booking_date, b.status, b.checked_in,
                   e.id AS event_id, e.title, e.event_date, e.end_time, e.event_type, e.location,
                   e.total_seats, e.available_seats, e.ticket_price
            FROM bookings b
            JOIN events e ON e.id = b.event_id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC
        ');
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        $bookings = $res->fetch_all(MYSQLI_ASSOC);

        // Also fetch waitlist items
        $wStmt = $mysqli->prepare('
            SELECT w.id AS waitlist_id, w.joined_at,
                   e.id AS event_id, e.title, e.event_date, e.end_time, e.event_type, e.location,
                   e.total_seats, e.available_seats, e.ticket_price
            FROM waitlist w
            JOIN events e ON e.id = w.event_id
            WHERE w.user_id = ?
            ORDER BY w.joined_at DESC
        ');
        $wStmt->bind_param('i', $userId);
        $wStmt->execute();
        $wRes = $wStmt->get_result();
        $waitlists = $wRes->fetch_all(MYSQLI_ASSOC);

        echo json_encode(['bookings' => $bookings, 'waitlists' => $waitlists]);
        break;

    // ─────────────────────────────────────────────────────────
    // ATTENDEES - Host tools: list attendees for an event
    // ─────────────────────────────────────────────────────────
    case 'attendees':
        if ($method !== 'GET') { http_response_code(405); exit; }
        $userId = requireAuth();
        $eventId = (int)($_GET['event_id'] ?? 0);

        if ($eventId < 1) { http_response_code(400); exit; }

        // Verify ownership
        $eStmt = $mysqli->prepare('SELECT creator_id FROM events WHERE id = ?');
        $eStmt->bind_param('i', $eventId);
        $eStmt->execute();
        $eRes = $eStmt->get_result();
        $event = $eRes->fetch_assoc();

        if (!$event || (int)$event['creator_id'] !== $userId) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied.']);
            exit;
        }

        $stmt = $mysqli->prepare('
            SELECT b.id AS booking_id, b.status, b.checked_in, u.full_name, u.email
            FROM bookings b
            JOIN users u ON u.id = b.user_id
            WHERE b.event_id = ? AND b.status = "active"
            ORDER BY u.full_name ASC
        ');
        $stmt->bind_param('i', $eventId);
        $stmt->execute();
        $res = $stmt->get_result();
        echo json_encode($res->fetch_all(MYSQLI_ASSOC));
        break;

    // ─────────────────────────────────────────────────────────
    // CHECK IN - Host tools: mark a booking as checked in
    // ─────────────────────────────────────────────────────────
    case 'check_in':
        if ($method !== 'POST') { http_response_code(405); exit; }
        $userId = requireAuth();
        $data   = json_decode(file_get_contents('php://input'), true);
        $bookingId = (int) ($data['booking_id'] ?? 0);
        $checkedIn = isset($data['checked_in']) && $data['checked_in'] ? 1 : 0;

        if ($bookingId < 1) { http_response_code(400); exit; }

        // Get event ID for this booking to verify ownership
        $bStmt = $mysqli->prepare('SELECT event_id FROM bookings WHERE id = ?');
        $bStmt->bind_param('i', $bookingId);
        $bStmt->execute();
        $bRes = $bStmt->get_result();
        $booking = $bRes->fetch_assoc();

        if (!$booking) { http_response_code(404); exit; }

        $eventId = (int) $booking['event_id'];

        // Verify ownership
        $eStmt = $mysqli->prepare('SELECT creator_id FROM events WHERE id = ?');
        $eStmt->bind_param('i', $eventId);
        $eStmt->execute();
        $eRes = $eStmt->get_result();
        $event = $eRes->fetch_assoc();

        if (!$event || (int)$event['creator_id'] !== $userId) {
            http_response_code(403); echo json_encode(['error' => 'Access denied.']); exit;
        }

        // Update
        $upd = $mysqli->prepare('UPDATE bookings SET checked_in = ? WHERE id = ?');
        $upd->bind_param('ii', $checkedIn, $bookingId);
        $upd->execute();

        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action.']);
        break;
}
