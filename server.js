const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Trust proxy (needed for Render.com reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'votaciones-secret-key-2026',
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 60 * 1000, // 30 minutes
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// Initialize database tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cedulas_autorizadas (
        id SERIAL PRIMARY KEY,
        cedula VARCHAR(30) NOT NULL UNIQUE,
        nombre VARCHAR(150) NOT NULL,
        seccion VARCHAR(10) DEFAULT '',
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS candidatos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        partido VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#6366f1',
        iniciales VARCHAR(5) NOT NULL,
        imagen_url TEXT DEFAULT '',
        activo BOOLEAN DEFAULT TRUE,
        orden INT DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS votos (
        id SERIAL PRIMARY KEY,
        cedula_id INT NOT NULL REFERENCES cedulas_autorizadas(id),
        candidato_id INT NOT NULL,
        voto_nombre VARCHAR(100) NOT NULL,
        fecha_voto TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(50) UNIQUE NOT NULL,
        valor TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: add imagen_url column if missing
    await client.query(`
      ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT '';
    `);

    // Insert default config if not exists
    const configDefaults = [
      ['titulo_sistema', 'Sistema de Votaciones Estudiantil'],
      ['subtitulo', 'Liceo Rural San Isidro'],
      ['votacion_activa', 'true'],
      ['mostrar_resultados', 'false'],
      ['logo_url', 'https://i.imgur.com/IGF1faP.png']
    ];

    for (const [clave, valor] of configDefaults) {
      await client.query(`
        INSERT INTO configuracion (clave, valor) 
        VALUES ($1, $2) 
        ON CONFLICT (clave) DO NOTHING
      `, [clave, valor]);
    }

    // Insert default admin users if not exist
    const adminHash = await bcrypt.hash('admin2026', 10);
    const devHash = await bcrypt.hash('dev2026', 10);

    await client.query(`
      INSERT INTO admin_users (username, password_hash, role) 
      VALUES ($1, $2, 'admin') 
      ON CONFLICT (username) DO NOTHING
    `, ['admin', adminHash]);

    await client.query(`
      INSERT INTO admin_users (username, password_hash, role) 
      VALUES ($1, $2, 'developer') 
      ON CONFLICT (username) DO NOTHING
    `, ['developer', devHash]);

    const candidateCount = await client.query('SELECT COUNT(*) FROM candidatos');
    if (parseInt(candidateCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO candidatos (nombre, partido, color, iniciales, orden) VALUES
        ('Ureña Garro Jefferson Andrey', 'GAP', '#ef4444', 'GAP', 1),
        ('Picado Chaves Ismael Steven', 'Coalición Impulso Estudiantil', '#3b82f6', 'CIE', 2)
      `);
    }

    // Insert students from all sections
    const studentCount = await client.query('SELECT COUNT(*) FROM cedulas_autorizadas');
    if (parseInt(studentCount.rows[0].count) === 0) {
      await insertStudents(client);
    }

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
  } finally {
    client.release();
  }
}

async function insertStudents(client) {
  const students = [
    // 7-1
    ['306160854', 'Abarca Portuguez Valentina de los Ángeles', '7-1'],
    ['306160465', 'Abarca Valverde Camila', '7-1'],
    ['306110556', 'Alvarado Blanco Jeykel Fabián', '7-1'],
    ['306150373', 'Castro Castillo Keylan Jesús', '7-1'],
    ['305950212', 'Fernández Velásquez Joshua Antonio', '7-1'],
    ['306160236', 'Garro Ceciliano Itzel Fernanda', '7-1'],
    ['306130754', 'Hernández Chaves Mariano David', '7-1'],
    ['306090637', 'Hernández Portuguez Matías José', '7-1'],
    ['121750063', 'Mora Abarca Mathías Jesús', '7-1'],
    ['306020373', 'Rivera Blanco Becky de los Ángeles', '7-1'],
    ['306140347', 'Segura Segura Kenia de los Ángeles', '7-1'],
    ['306090089', 'Ureña Portuguez Yarely de los Ángeles', '7-1'],
    ['121060778', 'Vargas Rodríguez Brittany Daniela', '7-1'],
    // 8-1
    ['306090731', 'Alpízar Hernández Yahel Adrián', '8-1'],
    ['306060986', 'Badilla Mora Allison Stacy', '8-1'],
    ['306030031', 'Calderón Hidalgo Brithany Paola', '8-1'],
    ['306050214', 'Cascante Carrillo Kevin Santiago', '8-1'],
    ['121370440', 'Castillo Mora Eva Luna', '8-1'],
    ['306100598', 'Castro Vega Sheila Nicole', '8-1'],
    ['306070082', 'Cruz Ortíz Roy', '8-1'],
    ['306090995', 'Gamboa Chacón María Valentina', '8-1'],
    ['306060739', 'Garro Mora Keyra Nicole', '8-1'],
    ['121430005', 'Gutiérrez Castro Allison Camila', '8-1'],
    ['306070576', 'Madrigal Ureña Anderson Daniel', '8-1'],
    ['306080965', 'Madriz Navarro Josué Jesús', '8-1'],
    ['305990917', 'Mena Hidalgo Luis Aaron', '8-1'],
    ['306100934', 'Mora Vega Kevin Jose', '8-1'],
    ['306040044', 'Navarro Mora Rachell Paola', '8-1'],
    ['155831646112', 'Peña García Ronaldito Jorbus', '8-1'],
    ['306070895', 'Picado Badilla Zaid Steven', '8-1'],
    ['306090577', 'Piedra Cruz Angie Roxana', '8-1'],
    ['305940187', 'Segura Herra Kendall Fabricio', '8-1'],
    ['306090653', 'Segura Ortiz Ashley Marialy', '8-1'],
    ['306030643', 'Ureña Alvarado Joikel Gabriel', '8-1'],
    ['306090740', 'Ureña Mora Eithan Dariel', '8-1'],
    // 9-1
    ['305960846', 'Arauz Quintero Natalia', '9-1'],
    ['121180374', 'Campos Sánchez Naomy de los Ángeles', '9-1'],
    ['605330170', 'Castillo Torres Sherlyn Jimena', '9-1'],
    ['306000788', 'Chaves Ceciliano Axel Gustavo', '9-1'],
    ['305930668', 'Chaves Mora Matías José', '9-1'],
    ['306040223', 'Espinoza Arauz Kimberly Cristina', '9-1'],
    ['306010647', 'Granados Navarro María Celeste', '9-1'],
    ['305970089', 'Jiménez Cascante Yared Noel', '9-1'],
    ['305980602', 'Madriz Navarro Keyler Victorino', '9-1'],
    ['306020781', 'Mora Agüero Nashley Yanina', '9-1'],
    ['305990464', 'Mora Porras Alexia Michelle', '9-1'],
    ['305990877', 'Picado Chaves Ismael Steven', '9-1'],
    ['306000253', 'Portuguez Calderón Caroline Daniela', '9-1'],
    ['306000365', 'Rojas Calderón Iván Santiago', '9-1'],
    ['305980702', 'Silva Venegas Daniela Nicole', '9-1'],
    ['306010761', 'Torres Segura Jesús David', '9-1'],
    ['305980760', 'Umaña Cruz Juan Daniel', '9-1'],
    ['305970485', 'Ureña Chaves Génesis Ivonne', '9-1'],
    ['306000881', 'Ureña Mora Dariel Adolfo', '9-1'],
    ['305990818', 'Ureña Núñez Samuel Johan', '9-1'],
    // 10-1
    ['305830224', 'Bejerano Sánchez Roberto Carlos', '10-1'],
    ['305910835', 'Castillo Calderón Emanuel Steven', '10-1'],
    ['305950624', 'Díaz Campos José Ángel', '10-1'],
    ['305890405', 'Hernández Portuguez Reichel Sofía', '10-1'],
    ['305940301', 'Jiménez Segura Darío Josué', '10-1'],
    ['305920761', 'Picado Mora Julián Andrés', '10-1'],
    ['305810042', 'Quesada Navarro Kevin Josué', '10-1'],
    ['305940119', 'Solano Mora Emily Nazareth', '10-1'],
    ['305890952', 'Ureña Garro Jefferson Andrey', '10-1'],
    ['305770225', 'Ureña Portuguez Ismael Gustavo', '10-1'],
    // 11-1
    ['305860830', 'Alvarado Blanco Kerlyn Adriana', '11-1'],
    ['120600050', 'Arauz Quintero Alexandra', '11-1'],
    ['305880934', 'Castillo Portuguez Deiby Alejandro', '11-1'],
    ['305860936', 'Cruz Hidalgo Maripaz', '11-1'],
    ['305550695', 'Jiménez Segura Gerson Starling', '11-1'],
    ['305850203', 'Jiménez Valverde David', '11-1'],
    ['305630988', 'Mesen Chaves Dylan Jesús', '11-1'],
    ['305880329', 'Mora Castro Luis Damián', '11-1'],
    ['305830739', 'Mora Fallas Jesús Alberto', '11-1'],
    ['305820314', 'Navarro Mora Jose Daniel', '11-1'],
    ['305800684', 'Otárola Prado Sebastián Antonio', '11-1'],
    ['155831646219', 'Peña García Junielka Nayancy', '11-1'],
    ['305840689', 'Porras Chaves Abrahán Isaac', '11-1'],
    ['305850373', 'Portuguez Venegas Franciny de los Ángeles', '11-1'],
    ['305850569', 'Prado Granados Josseline Natalia', '11-1'],
    ['305880884', 'Quesada Mora Juan Daniel', '11-1'],
    ['305790270', 'Sánchez Ceciliano Emmanuel Jesús', '11-1'],
    ['305890436', 'Segura Picado Nazareth de Jesús', '11-1'],
    ['305830672', 'Segura Segura Alison de los Ángeles', '11-1'],
    ['305880878', 'Ureña Mora Angélica Michel', '11-1'],
    ['305880346', 'Ureña Valverde José Emilio', '11-1'],
  ];

  for (const [cedula, nombre, seccion] of students) {
    await client.query(`
      INSERT INTO cedulas_autorizadas (cedula, nombre, seccion) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (cedula) DO NOTHING
    `, [cedula, nombre, seccion]);
  }
  console.log(`✅ ${students.length} students inserted`);
}

// =================== API ROUTES ===================

// Get system configuration
app.get('/api/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT clave, valor FROM configuracion');
    const config = {};
    result.rows.forEach(row => { config[row.clave] = row.valor; });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching config' });
  }
});

// Verify cedula
app.post('/api/verify-cedula', async (req, res) => {
  try {
    let { cedula } = req.body;
    cedula = cedula.replace(/[-\s]/g, '').trim();

    // Check voting active
    const configResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'votacion_activa'");
    if (configResult.rows.length > 0 && configResult.rows[0].valor === 'false') {
      return res.json({ success: false, message: 'La votación no está activa en este momento.' });
    }

    // Check if already voted
    const voteCheck = await pool.query(`
      SELECT v.id FROM votos v 
      INNER JOIN cedulas_autorizadas c ON v.cedula_id = c.id 
      WHERE c.cedula = $1
    `, [cedula]);

    if (voteCheck.rows.length > 0) {
      return res.json({ success: false, message: 'Esta cédula ya ha emitido su voto.' });
    }

    // Check if authorized
    const cedulaCheck = await pool.query(
      'SELECT id, nombre, seccion FROM cedulas_autorizadas WHERE cedula = $1 AND activa = TRUE',
      [cedula]
    );

    if (cedulaCheck.rows.length === 0) {
      return res.json({ success: false, message: 'Cédula no autorizada para votar.' });
    }

    const student = cedulaCheck.rows[0];
    req.session.cedula = cedula;
    req.session.cedulaId = student.id;
    req.session.nombre = student.nombre;
    req.session.seccion = student.seccion;

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, message: 'Error del servidor.' });
      }
      res.json({
        success: true,
        nombre: student.nombre,
        seccion: student.seccion
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

// Get candidates
app.get('/api/candidates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM candidatos WHERE activo = TRUE ORDER BY orden');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching candidates' });
  }
});

// Submit vote
app.post('/api/vote', async (req, res) => {
  try {
    if (!req.session.cedula || !req.session.cedulaId) {
      return res.json({ success: false, message: 'Sesión no válida. Por favor, ingrese su cédula nuevamente.' });
    }

    const { candidatoId, votoNombre } = req.body;

    // Double-check no duplicate vote
    const voteCheck = await pool.query(`
      SELECT v.id FROM votos v WHERE v.cedula_id = $1
    `, [req.session.cedulaId]);

    if (voteCheck.rows.length > 0) {
      req.session.destroy();
      return res.json({ success: false, message: 'Esta cédula ya ha emitido su voto.' });
    }

    await pool.query(
      'INSERT INTO votos (cedula_id, candidato_id, voto_nombre) VALUES ($1, $2, $3)',
      [req.session.cedulaId, candidatoId, votoNombre]
    );

    req.session.destroy();
    res.json({ success: true, message: '¡Voto registrado exitosamente!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al registrar el voto.' });
  }
});

// =================== ADMIN ROUTES ===================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Credenciales incorrectas.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.json({ success: false, message: 'Credenciales incorrectas.' });
    }

    req.session.adminUser = username;
    req.session.adminRole = user.role;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, message: 'Error del servidor.' });
      }
      res.json({ success: true, role: user.role, username });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

// Check admin session
app.get('/api/admin/session', (req, res) => {
  if (req.session.adminUser) {
    res.json({ loggedIn: true, role: req.session.adminRole, username: req.session.adminUser });
  } else {
    res.json({ loggedIn: false });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Middleware to check admin auth
function requireAdmin(req, res, next) {
  if (!req.session.adminUser) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

function requireDeveloper(req, res, next) {
  if (!req.session.adminUser || req.session.adminRole !== 'developer') {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// Get vote statistics
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalVotes = await pool.query('SELECT COUNT(*) as total FROM votos');
    const totalStudents = await pool.query('SELECT COUNT(*) as total FROM cedulas_autorizadas WHERE activa = TRUE');

    const votesByCandidate = await pool.query(`
      SELECT voto_nombre, COUNT(*) as total 
      FROM votos GROUP BY voto_nombre ORDER BY total DESC
    `);

    const votesBySection = await pool.query(`
      SELECT c.seccion, COUNT(v.id) as total 
      FROM votos v 
      JOIN cedulas_autorizadas c ON v.cedula_id = c.id 
      GROUP BY c.seccion ORDER BY c.seccion
    `);

    const recentVotes = await pool.query(`
      SELECT v.id, c.nombre, c.cedula, c.seccion, v.voto_nombre, v.fecha_voto 
      FROM votos v 
      JOIN cedulas_autorizadas c ON v.cedula_id = c.id 
      ORDER BY v.fecha_voto DESC LIMIT 50
    `);

    const participationBySection = await pool.query(`
      SELECT 
        ca.seccion,
        COUNT(DISTINCT ca.id) as total_students,
        COUNT(DISTINCT v.cedula_id) as voted
      FROM cedulas_autorizadas ca
      LEFT JOIN votos v ON ca.id = v.cedula_id
      WHERE ca.activa = TRUE
      GROUP BY ca.seccion
      ORDER BY ca.seccion
    `);

    res.json({
      totalVotes: parseInt(totalVotes.rows[0].total),
      totalStudents: parseInt(totalStudents.rows[0].total),
      votesByCandidate: votesByCandidate.rows,
      votesBySection: votesBySection.rows,
      recentVotes: recentVotes.rows,
      participationBySection: participationBySection.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// Get all students
app.get('/api/admin/students', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ca.*, 
        CASE WHEN v.id IS NOT NULL THEN true ELSE false END as ha_votado,
        v.voto_nombre, v.fecha_voto
      FROM cedulas_autorizadas ca
      LEFT JOIN votos v ON ca.id = v.cedula_id
      ORDER BY ca.seccion, ca.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching students' });
  }
});

// Delete a vote (developer only)
app.delete('/api/admin/votes/:id', requireDeveloper, async (req, res) => {
  try {
    await pool.query('DELETE FROM votos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting vote' });
  }
});

// Reset all votes (developer only)
app.post('/api/admin/reset-votes', requireDeveloper, async (req, res) => {
  try {
    await pool.query('DELETE FROM votos');
    res.json({ success: true, message: 'Todos los votos han sido eliminados.' });
  } catch (err) {
    res.status(500).json({ error: 'Error resetting votes' });
  }
});

// Update configuration
app.put('/api/admin/config', requireDeveloper, async (req, res) => {
  try {
    const { clave, valor } = req.body;
    await pool.query(`
      INSERT INTO configuracion (clave, valor) VALUES ($1, $2) 
      ON CONFLICT (clave) DO UPDATE SET valor = $2
    `, [clave, valor]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error updating config' });
  }
});

// Manage candidates
app.post('/api/admin/candidates', requireDeveloper, async (req, res) => {
  try {
    const { nombre, partido, color, iniciales, imagen_url, orden } = req.body;
    const result = await pool.query(
      'INSERT INTO candidatos (nombre, partido, color, iniciales, imagen_url, orden) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nombre, partido, color, iniciales, imagen_url || '', orden || 0]
    );
    res.json({ success: true, candidate: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error adding candidate' });
  }
});

app.put('/api/admin/candidates/:id', requireDeveloper, async (req, res) => {
  try {
    const { nombre, partido, color, iniciales, imagen_url, activo, orden } = req.body;
    await pool.query(
      'UPDATE candidatos SET nombre=$1, partido=$2, color=$3, iniciales=$4, imagen_url=$5, activo=$6, orden=$7 WHERE id=$8',
      [nombre, partido, color, iniciales, imagen_url || '', activo, orden, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error updating candidate' });
  }
});

app.delete('/api/admin/candidates/:id', requireDeveloper, async (req, res) => {
  try {
    await pool.query('DELETE FROM candidatos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting candidate' });
  }
});

// Add student
app.post('/api/admin/students', requireDeveloper, async (req, res) => {
  try {
    const { cedula, nombre, seccion } = req.body;
    const result = await pool.query(
      'INSERT INTO cedulas_autorizadas (cedula, nombre, seccion) VALUES ($1, $2, $3) RETURNING *',
      [cedula, nombre, seccion]
    );
    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.json({ success: false, message: 'Esta cédula ya existe en el sistema.' });
    } else {
      res.status(500).json({ error: 'Error adding student' });
    }
  }
});

// Toggle student status
app.put('/api/admin/students/:id/toggle', requireDeveloper, async (req, res) => {
  try {
    await pool.query('UPDATE cedulas_autorizadas SET activa = NOT activa WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error toggling student' });
  }
});

// Delete student
app.delete('/api/admin/students/:id', requireDeveloper, async (req, res) => {
  try {
    // First delete any votes by this student
    await pool.query('DELETE FROM votos WHERE cedula_id = $1', [req.params.id]);
    await pool.query('DELETE FROM cedulas_autorizadas WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting student' });
  }
});

// Get all candidates (admin)
app.get('/api/admin/candidates', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM candidatos ORDER BY orden');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching candidates' });
  }
});

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🗳️  Voting server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
  });
});
