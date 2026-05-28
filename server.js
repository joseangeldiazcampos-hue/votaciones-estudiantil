const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { verify } = require('otplib');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI no está definido en el archivo .env o en el entorno.');
  process.exit(1);
}

// ── Conexión a MongoDB Atlas ─────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado exitosamente a MongoDB Atlas');
    inicializarDatosDefault();
  })
  .catch(err => {
    console.error('❌ Error de conexión a MongoDB Atlas:', err.message);
    process.exit(1);
  });

// ── Modelos y Esquemas de Mongoose ──────────────────────────────────────────
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
}, { collection: 'counters' });
const Counter = mongoose.model('Counter', counterSchema);

async function getNextId(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

const cedulaAutorizadaSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  cedula: { type: String, required: true, unique: true, index: true },
  nombre: { type: String, required: true },
  seccion: { type: String, default: '' },
  activa: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
}, { collection: 'cedulas_autorizadas' });
const CedulaAutorizada = mongoose.model('CedulaAutorizada', cedulaAutorizadaSchema);

const candidatoSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  nombre: { type: String, required: true },
  partido: { type: String, required: true },
  color: { type: String, default: '#6366f1' },
  iniciales: { type: String, required: true },
  imagen_url: { type: String, default: '' },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 }
}, { collection: 'candidatos' });
const Candidato = mongoose.model('Candidato', candidatoSchema);

const votoSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  cedula_id: { type: Number, required: true, index: true },
  candidato_id: { type: Number, required: true },
  voto_nombre: { type: String, required: true },
  fecha_voto: { type: Date, default: Date.now }
}, { collection: 'votos' });
const Voto = mongoose.model('Voto', votoSchema);

const configuracionSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true, index: true },
  valor: { type: String, required: true }
}, { collection: 'configuracion' });
const Configuracion = mongoose.model('Configuracion', configuracionSchema);

const adminUserSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  username: { type: String, required: true, unique: true, index: true },
  password_hash: { type: String, required: true },
  role: { type: String, default: 'admin' },
  created_at: { type: Date, default: Date.now }
}, { collection: 'admin_users' });
const AdminUser = mongoose.model('AdminUser', adminUserSchema);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// ── Configuración de Sesiones con connect-mongo ──────────────────────────────
app.use(session({
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
    ttl: 30 * 60 // 30 minutos
  }),
  secret: process.env.SESSION_SECRET || 'votaciones-secret-key-2026-secure',
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 60 * 1000, // 30 minutos
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// ── Inicialización de Datos Default ─────────────────────────────────────────
async function inicializarDatosDefault() {
  try {
    // 1. Configuración por defecto
    const configDefaults = [
      ['titulo_sistema', 'Sistema de Votaciones Estudiantil'],
      ['subtitulo', 'Liceo Rural San Isidro'],
      ['votacion_activa', 'true'],
      ['mostrar_resultados', 'false'],
      ['logo_url', 'https://i.imgur.com/IGF1faP.png']
    ];

    for (const [clave, valor] of configDefaults) {
      const existe = await Configuracion.findOne({ clave });
      if (!existe) {
        await Configuracion.create({ clave, valor });
      }
    }

    // 2. Usuarios por defecto (admin y dev) con TOTP Secrets
    await AdminUser.deleteMany({}); // Reset for new TOTP system
    const adminSecret = 'HJQYBGYJ3EI26EDDRJ735HJUK24KNLGK';
    const nextIdAdmin = await getNextId('adminUserId');
    await AdminUser.create({ id: nextIdAdmin, username: 'admin', password_hash: adminSecret, role: 'admin' });

    const devSecret = 'GESOTLORC376IW27XU7FZNM2V3DK2X3Z';
    const nextIdDev = await getNextId('adminUserId');
    await AdminUser.create({ id: nextIdDev, username: 'developer', password_hash: devSecret, role: 'developer' });

    // 3. Candidatos por defecto
    const candidatosCant = await Candidato.countDocuments({});
    if (candidatosCant === 0) {
      const id1 = await getNextId('candidatoId');
      const id2 = await getNextId('candidatoId');
      await Candidato.create([
        { id: id1, nombre: 'Ureña Garro Jefferson Andrey', partido: 'GAP', color: '#ef4444', iniciales: 'GAP', imagen_url: '/gap.png', orden: 1 },
        { id: id2, nombre: 'Picado Chaves Ismael Steven', partido: 'Coalición Impulso Estudiantil', color: '#3b82f6', iniciales: 'CIE', imagen_url: '/cie.png', orden: 2 }
      ]);
      console.log('✅ Candidatos iniciales creados');
    } else {
      // Forzar actualización de datos oficiales
      await Candidato.updateMany({ iniciales: 'GAP' }, { imagen_url: '/gap.png', nombre: 'Ureña Garro Jefferson Andrey', partido: 'GAP', iniciales: 'GAP' });
      await Candidato.updateMany({ iniciales: 'CIE' }, { imagen_url: '/cie.png', nombre: 'Picado Chaves Ismael Steven', partido: 'Coalición Impulso Estudiantil', iniciales: 'CIE' });
      await Candidato.updateMany({ iniciales: { $nin: ['GAP', 'CIE'] } }, { activo: false });
    }

    // 4. Estudiantes
    const estudiantesCant = await CedulaAutorizada.countDocuments({});
    if (estudiantesCant === 0) {
      await insertarEstudiantes();
    }

    console.log('✅ Base de datos MongoDB inicializada con éxito');
  } catch (err) {
    console.error('❌ Error inicializando datos en MongoDB:', err);
  }
}

async function insertarEstudiantes() {
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
    const nextId = await getNextId('studentId');
    await CedulaAutorizada.create({
      id: nextId,
      cedula,
      nombre,
      seccion
    });
  }
  console.log(`✅ ${students.length} estudiantes autorizados insertados en MongoDB`);
}

// =================== RUTAS DE LA API ===================

// Obtener configuración visual y estado
app.get('/api/config', async (req, res) => {
  try {
    const result = await Configuracion.find({});
    const config = {};
    result.forEach(doc => { config[doc.clave] = doc.valor; });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la configuración' });
  }
});

// Verificar cédula
app.post('/api/verify-cedula', async (req, res) => {
  try {
    let { cedula } = req.body;
    if (!cedula) return res.status(400).json({ success: false, message: 'Cédula requerida' });
    
    cedula = cedula.replace(/[-\s]/g, '').trim();

    // Validar si la votación está activa
    const configActiva = await Configuracion.findOne({ clave: 'votacion_activa' });
    if (configActiva && configActiva.valor === 'false') {
      return res.json({ success: false, message: 'La votación no está activa en este momento.' });
    }

    // Verificar si el estudiante está registrado y activo
    const estudiante = await CedulaAutorizada.findOne({ cedula, activa: true });
    if (!estudiante) {
      return res.json({ success: false, message: 'Cédula no autorizada para votar.' });
    }

    // Verificar si ya emitió el voto
    const votoExiste = await Voto.findOne({ cedula_id: estudiante.id });
    if (votoExiste) {
      return res.json({ success: false, message: 'Esta cédula ya ha emitido su voto.' });
    }

    // Registrar en sesión
    req.session.cedula = cedula;
    req.session.cedulaId = estudiante.id;
    req.session.nombre = estudiante.nombre;
    req.session.seccion = estudiante.seccion;

    req.session.save((err) => {
      if (err) {
        console.error('Error al guardar la sesión:', err);
        return res.status(500).json({ success: false, message: 'Error del servidor.' });
      }
      res.json({
        success: true,
        nombre: estudiante.nombre,
        seccion: estudiante.seccion
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// Obtener candidatos activos
app.get('/api/candidates', async (req, res) => {
  try {
    const candidatos = await Candidato.find({ activo: true }).sort({ orden: 1 });
    res.json(candidatos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener candidatos' });
  }
});

// Registrar voto
app.post('/api/vote', async (req, res) => {
  try {
    if (!req.session.cedula || !req.session.cedulaId) {
      return res.json({ success: false, message: 'Sesión no válida. Por favor, ingrese su cédula nuevamente.' });
    }

    const { candidatoId, votoNombre } = req.body;

    // Verificar doble voto por seguridad
    const votoExiste = await Voto.findOne({ cedula_id: req.session.cedulaId });
    if (votoExiste) {
      req.session.destroy();
      return res.json({ success: false, message: 'Esta cédula ya ha emitido su voto.' });
    }

    // Generar ID e insertar voto
    const nextId = await getNextId('votoId');
    await Voto.create({
      id: nextId,
      cedula_id: req.session.cedulaId,
      candidato_id: candidatoId,
      voto_nombre: votoNombre
    });

    req.session.destroy();
    res.json({ success: true, message: '¡Voto registrado exitosamente!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al registrar el voto.' });
  }
});

// =================== RUTAS DE ADMINISTRACIÓN ===================

// Login admin (TOTP / BN Token style)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ success: false, message: 'Token requerido.' });

    const users = await AdminUser.find({});
    let authenticatedUser = null;

    for (const user of users) {
      try {
        const { valid } = await verify({ token, secret: user.password_hash, window: 2 });
        if (valid) {
          authenticatedUser = user;
          break;
        }
      } catch (err) {
        // Ignore verify errors (e.g. malformed token)
      }
    }

    if (!authenticatedUser) {
      return res.json({ success: false, message: 'Token inválido o expirado.' });
    }

    req.session.adminUser = authenticatedUser.username;
    req.session.adminRole = authenticatedUser.role;
    req.session.save((err) => {
      if (err) {
        console.error('Error al guardar la sesión admin:', err);
        return res.status(500).json({ success: false, message: 'Error del servidor.' });
      }
      res.json({ success: true, role: authenticatedUser.role, username: authenticatedUser.username });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

// Verificar sesión admin
app.get('/api/admin/session', (req, res) => {
  if (req.session.adminUser) {
    res.json({ loggedIn: true, role: req.session.adminRole, username: req.session.adminUser });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout admin
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Middleware de autenticación
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

// Obtener estadísticas de votación
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalVotes = await Voto.countDocuments({});
    const totalStudents = await CedulaAutorizada.countDocuments({ activa: true });

    // Votos agrupados por candidato
    const rawVotesByCandidate = await Voto.aggregate([
      { $group: { _id: '$voto_nombre', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    const votesByCandidate = rawVotesByCandidate.map(r => ({
      voto_nombre: r._id,
      total: r.total
    }));

    // Votos agrupados por sección
    const rawVotesBySection = await Voto.aggregate([
      {
        $lookup: {
          from: 'cedulas_autorizadas',
          localField: 'cedula_id',
          foreignField: 'id',
          as: 'estudiante'
        }
      },
      { $unwind: '$estudiante' },
      { $group: { _id: '$estudiante.seccion', total: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const votesBySection = rawVotesBySection.map(r => ({
      seccion: r._id,
      total: r.total
    }));

    // Últimos 50 votos registrados
    const recentVotes = await Voto.aggregate([
      {
        $lookup: {
          from: 'cedulas_autorizadas',
          localField: 'cedula_id',
          foreignField: 'id',
          as: 'estudiante'
        }
      },
      { $unwind: '$estudiante' },
      { $sort: { fecha_voto: -1 } },
      { $limit: 50 },
      {
        $project: {
          id: '$id',
          nombre: '$estudiante.nombre',
          cedula: '$estudiante.cedula',
          seccion: '$estudiante.seccion',
          voto_nombre: '$voto_nombre',
          fecha_voto: '$fecha_voto'
        }
      }
    ]);

    // Participación y votos por sección
    const participationBySection = await CedulaAutorizada.aggregate([
      { $match: { activa: true } },
      {
        $lookup: {
          from: 'votos',
          localField: 'id',
          foreignField: 'cedula_id',
          as: 'voto'
        }
      },
      {
        $group: {
          _id: '$seccion',
          total_students: { $sum: 1 },
          voted: {
            $sum: {
              $cond: [{ $gt: [{ $size: '$voto' }, 0] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          seccion: '$_id',
          total_students: 1,
          voted: 1
        }
      }
    ]);

    res.json({
      totalVotes,
      totalStudents,
      votesByCandidate,
      votesBySection,
      recentVotes,
      participationBySection
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Obtener lista completa de estudiantes con estado de voto
app.get('/api/admin/students', requireAdmin, async (req, res) => {
  try {
    const studentsList = await CedulaAutorizada.aggregate([
      {
        $lookup: {
          from: 'votos',
          localField: 'id',
          foreignField: 'cedula_id',
          as: 'voto'
        }
      },
      {
        $project: {
          id: '$id',
          cedula: '$cedula',
          nombre: '$nombre',
          seccion: '$seccion',
          activa: '$activa',
          created_at: '$created_at',
          ha_votado: { $gt: [{ $size: '$voto' }, 0] },
          voto_nombre: { $ifNull: [{ $arrayElemAt: ['$voto.voto_nombre', 0] }, null] },
          fecha_voto: { $ifNull: [{ $arrayElemAt: ['$voto.fecha_voto', 0] }, null] }
        }
      },
      { $sort: { seccion: 1, nombre: 1 } }
    ]);
    res.json(studentsList);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Eliminar un voto individual (solo desarrollador)
app.delete('/api/admin/votes/:id', requireDeveloper, async (req, res) => {
  try {
    const result = await Voto.deleteOne({ id: parseInt(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Voto no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el voto' });
  }
});

// Resetear todos los votos (solo desarrollador)
app.post('/api/admin/reset-votes', requireDeveloper, async (req, res) => {
  try {
    await Voto.deleteMany({});
    res.json({ success: true, message: 'Todos los votos han sido eliminados.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al resetear votos' });
  }
});

// Guardar/Actualizar configuración (solo desarrollador)
app.put('/api/admin/config', requireDeveloper, async (req, res) => {
  try {
    const { clave, valor } = req.body;
    await Configuracion.updateOne(
      { clave },
      { $set: { valor } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

// Agregar candidato (solo desarrollador)
app.post('/api/admin/candidates', requireDeveloper, async (req, res) => {
  try {
    const { nombre, partido, color, iniciales, imagen_url, orden } = req.body;
    const nextId = await getNextId('candidatoId');
    const nuevo = await Candidato.create({
      id: nextId,
      nombre,
      partido,
      color,
      iniciales,
      imagen_url: imagen_url || '',
      orden: orden || 0
    });
    res.json({ success: true, candidate: nuevo });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar candidato' });
  }
});

// Modificar candidato (solo desarrollador)
app.put('/api/admin/candidates/:id', requireDeveloper, async (req, res) => {
  try {
    const { nombre, partido, color, iniciales, imagen_url, activo, orden } = req.body;
    const result = await Candidato.updateOne(
      { id: parseInt(req.params.id) },
      {
        $set: {
          nombre,
          partido,
          color,
          iniciales,
          imagen_url: imagen_url || '',
          activo,
          orden
        }
      }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar candidato' });
  }
});

// Eliminar candidato (solo desarrollador)
app.delete('/api/admin/candidates/:id', requireDeveloper, async (req, res) => {
  try {
    const result = await Candidato.deleteOne({ id: parseInt(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar candidato' });
  }
});

// Obtener todos los candidatos para el panel de administración
app.get('/api/admin/candidates', requireAdmin, async (req, res) => {
  try {
    const candidatos = await Candidato.find({}).sort({ orden: 1 });
    res.json(candidatos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener candidatos' });
  }
});

// Agregar estudiante autorizado (solo desarrollador)
app.post('/api/admin/students', requireDeveloper, async (req, res) => {
  try {
    const { cedula, nombre, seccion } = req.body;
    
    const existe = await CedulaAutorizada.findOne({ cedula });
    if (existe) {
      return res.json({ success: false, message: 'Esta cédula ya existe en el sistema.' });
    }

    const nextId = await getNextId('studentId');
    const nuevo = await CedulaAutorizada.create({
      id: nextId,
      cedula,
      nombre,
      seccion
    });
    res.json({ success: true, student: nuevo });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar estudiante' });
  }
});

// Activar/Desactivar estudiante (solo desarrollador)
app.put('/api/admin/students/:id/toggle', requireDeveloper, async (req, res) => {
  try {
    const estudiante = await CedulaAutorizada.findOne({ id: parseInt(req.params.id) });
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    estudiante.activa = !estudiante.activa;
    await estudiante.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al activar/desactivar estudiante' });
  }
});

// Eliminar estudiante y su voto asociado (solo desarrollador)
app.delete('/api/admin/students/:id', requireDeveloper, async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    // Eliminar votos del estudiante primero
    await Voto.deleteMany({ cedula_id: idNum });
    const result = await CedulaAutorizada.deleteOne({ id: idNum });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar estudiante' });
  }
});

// ── Rutas de Páginas ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/votar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/developer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`🗳️  Servidor de Votaciones corriendo en puerto ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
