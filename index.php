<?php
require_once 'config.php';
session_start();

$message = '';
$show_candidates = false;

// Check if form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (isset($_POST['cedula'])) {
        $cedula = $_POST['cedula'];
        
        // Primero verificar si la cédula ya votó
        $check_voto_sql = "SELECT v.id 
                          FROM votos v 
                          INNER JOIN cedulas_autorizadas c ON v.cedula_id = c.id 
                          WHERE c.cedula = ?";
        $stmt = $conn->prepare($check_voto_sql);
        $stmt->bind_param("s", $cedula);
        $stmt->execute();
        $voto_result = $stmt->get_result();
        
        if ($voto_result->num_rows > 0) {
            $message = "Esta cédula ya ha emitido su voto.";
        } else {
            // Si no ha votado, verificar si está autorizada
            $check_cedula_sql = "SELECT nombre FROM cedulas_autorizadas WHERE cedula = ? AND activa = TRUE";
            $stmt = $conn->prepare($check_cedula_sql);
            $stmt->bind_param("s", $cedula);
            $stmt->execute();
            $cedula_result = $stmt->get_result();
            
            if ($cedula_result->num_rows == 0) {
                $message = "Cédula no autorizada para votar.";
            } else {
                // Si está autorizada y no ha votado, permitir el voto
                $persona = $cedula_result->fetch_assoc();
                $_SESSION['cedula'] = $cedula;
                $_SESSION['nombre'] = $persona['nombre'];
                $show_candidates = true;
            }
        }
    } elseif (isset($_POST['voto']) && isset($_SESSION['cedula'])) {
        $cedula = $_SESSION['cedula'];
        $voto = $_POST['voto'];
        
        // Get cedula_id first
        $get_cedula_id_sql = "SELECT id FROM cedulas_autorizadas WHERE cedula = ?";
        $stmt = $conn->prepare($get_cedula_id_sql);
        $stmt->bind_param("s", $cedula);
        $stmt->execute();
        $cedula_id_result = $stmt->get_result();
        
        if ($cedula_id_result->num_rows > 0) {
            $cedula_data = $cedula_id_result->fetch_assoc();
            $cedula_id = $cedula_data['id'];
            
            // Insert vote using cedula_id
            $insert_sql = "INSERT INTO votos (cedula_id, voto) VALUES (?, ?)";
            $stmt = $conn->prepare($insert_sql);
            $stmt->bind_param("is", $cedula_id, $voto);
            
            if ($stmt->execute()) {
                $message = "¡Voto registrado exitosamente! Su sesión ha sido cerrada.";
                session_destroy();
                // Redirect to prevent form resubmission
                header("Location: index.php?success=1");
                exit;
            } else {
                $message = "Error al registrar el voto. Por favor, intente nuevamente.";
            }
        } else {
            $message = "Error: No se encontró la cédula en la base de datos.";
            session_destroy();
        }
    }
}

// Check if we should show candidates
$show_candidates = isset($_SESSION['cedula']);

// If someone tries to access the voting page directly without a valid session
if (!$show_candidates && isset($_POST['voto'])) {
    $message = "Su sesión ha expirado o no ha ingresado su cédula. Por favor, ingrese su cédula nuevamente.";
    session_destroy();
}

// Check for success message
if (isset($_GET['success'])) {
    $message = "¡Voto registrado exitosamente! Su sesión ha sido cerrada.";
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Votación</title>
    <link rel="icon" type="image/png" href="https://i.imgur.com/IGF1faP.png">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f0f2f5;
        }
        .admin-link {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #1a73e8;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: bold;
            transition: background-color 0.3s;
        }
        .admin-link:hover {
            background-color: #1557b0;
        }
        .dev-link {
            position: fixed;
            top: 20px;
            right: 180px;
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: bold;
            transition: background-color 0.3s;
        }
        .dev-link:hover {
            background-color: #45a049;
        }
        .container {
            text-align: center;
            background-color: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            width: 90%;
            max-width: 500px;
        }
        .escudo {
            width: 100px;
            height: 100px;
            margin: 0 auto 1.5rem;
            display: block;
        }
        h1 {
            color: #1a73e8;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        input[type="text"] {
            width: 100%;
            padding: 0.8rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
            box-sizing: border-box;
        }
        button {
            background-color: #1a73e8;
            color: white;
            padding: 0.8rem 1.5rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            width: 100%;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #1557b0;
        }
        .message {
            margin-top: 1rem;
            padding: 0.8rem;
            border-radius: 4px;
            text-align: center;
        }
        .error {
            background-color: #fdecea;
            color: #d93025;
        }
        .success {
            background-color: #e6f4ea;
            color: #137333;
        }
        .radio-group {
            display: flex;
            flex-direction: row;
            gap: 1rem;
            margin-top: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        .radio-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1rem;
            border: 2px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            width: 150px;
        }
        .radio-option:hover {
            border-color: #1a73e8;
            background-color: #f8f9fa;
        }
        .radio-option.selected {
            border-color: #1a73e8;
            background-color: #e8f0fe;
        }
        .radio-option input[type="radio"] {
            display: none;
        }
        .candidate-details {
            text-align: center;
            margin-top: 0.5rem;
        }
        .candidate-name {
            font-weight: bold;
            font-size: 1.1rem;
            color: #333;
        }
        .candidate-party {
            color: #666;
            font-size: 0.9rem;
        }
        .candidate-image {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background-color: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: #666;
            margin-bottom: 0.5rem;
        }
        .candidate-image.partido-verde {
            background-color: #4CAF50;
            color: white;
        }
        .candidate-image.partido-azul {
            background-color: #2196F3;
            color: white;
        }
        .candidate-image.partido-rojo {
            background-color: #F44336;
            color: white;
        }
        .candidate-image.voto-nulo {
            background-color: #FFC107;
            color: white;
        }
        .session-info {
            background-color: #e8f0fe;
            padding: 0.8rem;
            border-radius: 4px;
            margin-bottom: 1.5rem;
            color: #1a73e8;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <a href="admin.php" class="admin-link">Panel de Administración</a>
    <a href="admin.php" class="dev-link">Panel de Desarrolladores</a>
    <div class="container">
        <img src="https://i.imgur.com/IGF1faP.png" alt="Escudo" class="escudo">
        <h1>Sistema de Votación</h1>
        <?php if (isset($message)): ?>
            <div class="message <?php echo strpos($message, 'Error') !== false ? 'error' : 'success'; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>
        <?php if ($show_candidates): ?>
            <div class="session-info">
                Cédula Verificada: <?php echo $_SESSION['nombre']; ?>
            </div>
            <form method="POST" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" id="votingForm">
                <div class="form-group">
                    <label style="font-size: 1.2rem; margin-bottom: 1rem; display: block;">Seleccione su candidato:</label>
                    <div class="radio-group">
                        <div class="radio-option" onclick="document.getElementById('candidato1').checked = true; document.getElementById('votingForm').submit();">
                            <input type="radio" id="candidato1" name="voto" value="Partido Verde" required>
                            <div class="candidate-image partido-verde">JP</div>
                            <div class="candidate-details">
                                <div class="candidate-name">Juan Pérez</div>
                                <div class="candidate-party">Partido Verde</div>
                            </div>
                        </div>
                        <div class="radio-option" onclick="document.getElementById('candidato2').checked = true; document.getElementById('votingForm').submit();">
                            <input type="radio" id="candidato2" name="voto" value="Partido Azul">
                            <div class="candidate-image partido-azul">MG</div>
                            <div class="candidate-details">
                                <div class="candidate-name">María González</div>
                                <div class="candidate-party">Partido Azul</div>
                            </div>
                        </div>
                        <div class="radio-option" onclick="document.getElementById('candidato3').checked = true; document.getElementById('votingForm').submit();">
                            <input type="radio" id="candidato3" name="voto" value="Partido Rojo">
                            <div class="candidate-image partido-rojo">CR</div>
                            <div class="candidate-details">
                                <div class="candidate-name">Carlos Rodríguez</div>
                                <div class="candidate-party">Partido Rojo</div>
                            </div>
                        </div>
                        <div class="radio-option null-vote" onclick="document.getElementById('voto_nulo').checked = true; document.getElementById('votingForm').submit();">
                            <input type="radio" id="voto_nulo" name="voto" value="Voto Nulo">
                            <div class="candidate-image voto-nulo">VN</div>
                            <div class="candidate-details">
                                <div class="candidate-name">Voto Nulo</div>
                                <div class="candidate-party">No seleccionar ningún candidato</div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        <?php else: ?>
            <form method="POST" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>">
                <div class="form-group">
                    <input type="text" id="cedula" name="cedula" placeholder="Ingrese su número de cédula" required>
                </div>
                <button type="submit">Ingresar</button>
            </form>
        <?php endif; ?>
    </div>
</body>
</html> 