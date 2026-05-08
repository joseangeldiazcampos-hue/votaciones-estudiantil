<?php
session_start();
require_once 'config.php';

// Check if already logged in as admin
if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    // Get all votes
    $sql = "SELECT * FROM votos ORDER BY fecha_voto DESC";
    $result = $conn->query($sql);

    // Get vote statistics
    $stats_sql = "SELECT voto, COUNT(*) as total FROM votos GROUP BY voto";
    $stats_result = $conn->query($stats_sql);
    
    // Prepare data for chart
    $chart_data = [];
    $total_votes = 0;
    while($row = $stats_result->fetch_assoc()) {
        $chart_data[] = $row;
        $total_votes += $row['total'];
    }
}

// Check if already logged in as developer
if (isset($_SESSION['dev_logged_in']) && $_SESSION['dev_logged_in'] === true) {
    // Get all votes
    $sql = "SELECT * FROM votos ORDER BY fecha_voto DESC";
    $result = $conn->query($sql);

    // Get vote statistics
    $stats_sql = "SELECT voto, COUNT(*) as total FROM votos GROUP BY voto";
    $stats_result = $conn->query($stats_sql);
    
    // Prepare data for chart
    $chart_data = [];
    $total_votes = 0;
    while($row = $stats_result->fetch_assoc()) {
        $chart_data[] = $row;
        $total_votes += $row['total'];
    }
}

// Handle admin login
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['login'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];
    
    if ($username === 'admin' && $password === 'admin123') {
        $_SESSION['admin_logged_in'] = true;
        
        // Get data immediately after login
        $sql = "SELECT * FROM votos ORDER BY fecha_voto DESC";
        $result = $conn->query($sql);

        $stats_sql = "SELECT voto, COUNT(*) as total FROM votos GROUP BY voto";
        $stats_result = $conn->query($stats_sql);
        
        $chart_data = [];
        $total_votes = 0;
        while($row = $stats_result->fetch_assoc()) {
            $chart_data[] = $row;
            $total_votes += $row['total'];
        }
    } else {
        $error_message = "Credenciales incorrectas";
    }
}

// Handle developer login
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['dev_login'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];
    
    if ($username === 'liceo' && $password === 'liceo123') {
        $_SESSION['dev_logged_in'] = true;
        
        // Get data immediately after login
        $sql = "SELECT * FROM votos ORDER BY fecha_voto DESC";
        $result = $conn->query($sql);

        $stats_sql = "SELECT voto, COUNT(*) as total FROM votos GROUP BY voto";
        $stats_result = $conn->query($stats_sql);
        
        $chart_data = [];
        $total_votes = 0;
        while($row = $stats_result->fetch_assoc()) {
            $chart_data[] = $row;
            $total_votes += $row['total'];
        }
    } else {
        $error_message = "Credenciales incorrectas";
    }
}

// Handle vote deletion (only for developers)
if (isset($_GET['delete']) && is_numeric($_GET['delete']) && isset($_SESSION['dev_logged_in'])) {
    $delete_id = $_GET['delete'];
    $delete_sql = "DELETE FROM votos WHERE id = $delete_id";
    if ($conn->query($delete_sql) === TRUE) {
        // Refresh data after deletion
        $sql = "SELECT * FROM votos ORDER BY fecha_voto DESC";
        $result = $conn->query($sql);

        $stats_sql = "SELECT voto, COUNT(*) as total FROM votos GROUP BY voto";
        $stats_result = $conn->query($stats_sql);
        
        $chart_data = [];
        $total_votes = 0;
        while($row = $stats_result->fetch_assoc()) {
            $chart_data[] = $row;
            $total_votes += $row['total'];
        }
    }
}

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: index.php");
    exit;
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administración</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            font-size: 16px;
        }
        button:hover {
            background-color: #45a049;
        }
        .message {
            margin: 20px 0;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
        }
        .error {
            background-color: #f2dede;
            color: #a94442;
        }
        .success {
            background-color: #dff0d8;
            color: #3c763d;
        }
        .login-container {
            display: flex;
            justify-content: space-around;
            gap: 20px;
            margin-bottom: 30px;
        }
        .login-box {
            flex: 1;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: white;
        }
        .login-box h2 {
            text-align: center;
            color: #333;
            margin-top: 0;
        }
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .logout-btn {
            background-color: #dc3545;
            width: auto;
            padding: 8px 15px;
        }
        .logout-btn:hover {
            background-color: #c82333;
        }
        .delete-btn {
            background-color: #dc3545;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 14px;
        }
        .delete-btn:hover {
            background-color: #c82333;
        }
        .stats-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .chart-container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stats-card {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stats-card h3 {
            margin-top: 0;
            color: #333;
        }
        .stats-value {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
        }
        .candidate-stats {
            margin-top: 10px;
        }
        .candidate-stat {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .candidate-stat:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if (!isset($_SESSION['admin_logged_in']) && !isset($_SESSION['dev_logged_in'])): ?>
            <h1>Panel de Administración</h1>
            
            <?php if (isset($error_message)): ?>
                <div class="message error">
                    <?php echo $error_message; ?>
                </div>
            <?php endif; ?>

            <div class="login-container">
                <div class="login-box">
                    <h2>Administrador</h2>
                    <form method="POST" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>">
                        <div class="form-group">
                            <label for="username">Usuario:</label>
                            <input type="text" id="username" name="username" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Contraseña:</label>
                            <input type="password" id="password" name="password" required>
                        </div>
                        <button type="submit" name="login">Iniciar Sesión</button>
                    </form>
                </div>

                <div class="login-box">
                    <h2>Desarrolladores</h2>
                    <form method="POST" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>">
                        <div class="form-group">
                            <label for="dev_username">Usuario:</label>
                            <input type="text" id="dev_username" name="username" required>
                        </div>
                        <div class="form-group">
                            <label for="dev_password">Contraseña:</label>
                            <input type="password" id="dev_password" name="password" required>
                        </div>
                        <button type="submit" name="dev_login">Iniciar Sesión</button>
                    </form>
                </div>
            </div>
        <?php else: ?>
            <div class="admin-header">
                <h1>Panel de <?php echo isset($_SESSION['dev_logged_in']) ? 'Desarrolladores' : 'Administración'; ?></h1>
                <a href="?logout=1" class="logout-btn">Cerrar Sesión</a>
            </div>

            <div class="stats-container">
                <div class="chart-container">
                    <h3>Distribución de Votos</h3>
                    <canvas id="votesChart"></canvas>
                </div>
                <div class="stats-card">
                    <h3>Estadísticas Generales</h3>
                    <div class="stats-value"><?php echo $total_votes; ?> votos totales</div>
                    <div class="candidate-stats">
                        <?php foreach ($chart_data as $data): ?>
                            <div class="candidate-stat">
                                <span><?php echo $data['voto']; ?></span>
                                <span><?php echo $data['total']; ?> votos</span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <?php if (isset($_SESSION['dev_logged_in']) && isset($result) && $result->num_rows > 0): ?>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Cédula</th>
                            <th>Voto</th>
                            <th>Fecha y Hora</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php while($row = $result->fetch_assoc()): ?>
                            <tr>
                                <td><?php echo $row['id']; ?></td>
                                <td><?php echo $row['cedula']; ?></td>
                                <td><?php echo $row['voto']; ?></td>
                                <td><?php echo $row['fecha_voto']; ?></td>
                                <td>
                                    <a href="?delete=<?php echo $row['id']; ?>" class="delete-btn" onclick="return confirm('¿Está seguro de que desea eliminar este voto?')">Eliminar</a>
                                </td>
                            </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            <?php endif; ?>

            <script>
                // Prepare data for chart
                const chartData = <?php echo json_encode($chart_data); ?>;
                const labels = chartData.map(item => item.voto);
                const data = chartData.map(item => item.total);
                const backgroundColors = [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)'
                ];

                // Create chart
                const ctx = document.getElementById('votesChart').getContext('2d');
                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: backgroundColors,
                            borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            </script>
        <?php endif; ?>
    </div>
</body>
</html> 