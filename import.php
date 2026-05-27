<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$dbname = 'event_booking'; // Change this if your db name in api/db.php is different

try {
    // 1. Connect to MySQL server (without DB)
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 2. Create Database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    echo "Database '$dbname' created or already exists.<br>";

    // 3. Connect to the created Database
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 4. Read and Execute schema.sql
    $sqlPath = __DIR__ . '/schema.sql';
    if (!file_exists($sqlPath)) {
        die("Error: schema.sql not found at " . $sqlPath . ". Please make sure schema.sql is in the same folder as this import.php file.");
    }

    $sql = file_get_contents($sqlPath);
    
    // Execute the schema
    $pdo->exec($sql);
    echo "<strong>Success!</strong> schema.sql has been imported.<br>";
    echo "You can now delete this import.php file and go to your website to log in.";

} catch (PDOException $e) {
    die("Database Error: " . $e->getMessage());
}