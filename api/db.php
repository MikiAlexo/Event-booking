<?php
/**
 * Database Connection - MySQLi Configuration
 * Configured for standard WAMP Server setup.
 */

// Database credentials
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'event_booking_system');
define('DB_USER', 'root');
define('DB_PASS', '');

/**
 * Returns a singleton mysqli connection instance.
 *
 * @return mysqli
 */
function getDBConnection(): mysqli
{
    static $mysqli = null;

    if ($mysqli === null) {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        
        try {
            $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
            $mysqli->set_charset('utf8mb4');
        } catch (mysqli_sql_exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }

    return $mysqli;
}
