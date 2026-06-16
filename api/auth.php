<?php
/**
 * Authentication API
 * Handles: register, login, logout, session-check
 * All responses are JSON.
 */

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

// Read the request method and action
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {

    // ─── Register ───────────────────────────────────────────
    case 'register':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $fullName = trim($data['full_name'] ?? '');
        $email    = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        // Validate inputs
        if ($fullName === '' || $email === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'All fields are required.']);
            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email address.']);
            exit;
        }

        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 6 characters.']);
            exit;
        }

        $mysqli = getDBConnection();

        // Check for existing email
        $stmt = $mysqli->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'An account with this email already exists.']);
            exit;
        }

        // Hash password and insert
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $mysqli->prepare('INSERT INTO users (email, password_hash, full_name, balance) VALUES (?, ?, ?, 1000.00)');
        $stmt->bind_param('sss', $email, $hash, $fullName);
        $stmt->execute();

        $userId = (int) $mysqli->insert_id;

        // Set session
        $_SESSION['user_id']   = $userId;
        $_SESSION['user_name'] = $fullName;
        $_SESSION['user_email'] = $email;
        $_SESSION['user_balance'] = 1000.00;

        echo json_encode([
            'success' => true,
            'user'    => [
                'id'        => $userId,
                'full_name' => $fullName,
                'email'     => $email,
                'balance'   => 1000.00,
            ],
        ]);
        break;

    // ─── Login ──────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $email    = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if ($email === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Email and password are required.']);
            exit;
        }

        $mysqli  = getDBConnection();
        $stmt = $mysqli->prepare('SELECT id, email, password_hash, full_name, balance FROM users WHERE email = ?');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid email or password.']);
            exit;
        }

        // Set session
        $_SESSION['user_id']    = (int) $user['id'];
        $_SESSION['user_name']  = $user['full_name'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_balance'] = (float) $user['balance'];

        echo json_encode([
            'success' => true,
            'user'    => [
                'id'        => (int) $user['id'],
                'full_name' => $user['full_name'],
                'email'     => $user['email'],
                'balance'   => (float) $user['balance'],
            ],
        ]);
        break;

    // ─── Logout ─────────────────────────────────────────────
    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(), '', time() - 42000,
                $params['path'], $params['domain'],
                $params['secure'], $params['httponly']
            );
        }
        session_destroy();

        echo json_encode(['success' => true]);
        break;

    // ─── Session Check ──────────────────────────────────────
    case 'check':
        if (isset($_SESSION['user_id'])) {
            // Re-fetch balance to ensure it's up to date
            $mysqli = getDBConnection();
            $stmt = $mysqli->prepare('SELECT balance FROM users WHERE id = ?');
            $stmt->bind_param('i', $_SESSION['user_id']);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                $_SESSION['user_balance'] = (float) $row['balance'];
            }

            echo json_encode([
                'logged_in' => true,
                'user'      => [
                    'id'        => $_SESSION['user_id'],
                    'full_name' => $_SESSION['user_name'],
                    'email'     => $_SESSION['user_email'],
                    'balance'   => $_SESSION['user_balance'] ?? 0.00,
                ],
            ]);
        } else {
            echo json_encode(['logged_in' => false]);
        }
        break;

    // ─── Unknown Action ─────────────────────────────────────
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Use: register, login, logout, check.']);
        break;
}
