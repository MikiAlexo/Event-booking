<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$dbname = 'event_booking_system';

try {
    // 1. Connect to MySQL server (without DB)
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $mysqli = new mysqli($host, $user, $pass);

    // 2. Create Database
    $mysqli->query("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    echo "Database '$dbname' created or already exists.<br>";

    // 3. Connect to the created Database
    $mysqli->select_db($dbname);

    // 4. Read and Execute schema.sql
    $sqlPath = __DIR__ . '/schema.sql';
    if (!file_exists($sqlPath)) {
        die("Error: schema.sql not found at " . $sqlPath . ". Please make sure schema.sql is in the same folder as this import.php file.");
    }

    $sql = file_get_contents($sqlPath);
    
    // Execute the schema
    if ($mysqli->multi_query($sql)) {
        do {
            if ($result = $mysqli->store_result()) {
                $result->free();
            }
        } while ($mysqli->more_results() && $mysqli->next_result());
    }
    
    echo "<strong>Success!</strong> schema.sql has been imported.<br>";
    echo "You can now delete this import.php file and go to your website to log in.";

} catch (mysqli_sql_exception $e) {
    die("Database Error: " . $e->getMessage());
}