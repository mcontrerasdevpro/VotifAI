import jwt from 'jsonwebtoken';
import { COOKIE_NAME } from './auth.js';
import { obtenerEstadoSuscripcion, MENSAJE_SIN_ACCESO } from '../lib/suscripciones.js';

// Modo solo lectura para despachos sin suscripción en vigor (prueba
// caducada, cancelada o con el primer pago sin completar): pueden seguir
// entrando y consultando/descargando todo, pero no crear ni modificar nada
// hasta que paguen. Se monta una sola vez delante de todos los routers de
// /api en vez de repetirse ruta a ruta, para que una ruta nueva quede
// cubierta sin tener que acordarse.
//
// Se deja pasar siempre:
// - lecturas (GET/HEAD/OPTIONS) y borrados (DELETE: quitarse datos propios
//   no da ningún valor que haya que cobrar, y un despacho que se va tiene
//   que poder limpiar lo suyo);
// - auth, billing y el perfil del despacho (sin ellos no podría ni entrar,
//   ni pagar, ni corregir su email o cambiar la contraseña);
// - todo el lado vecino: los propietarios no son clientes, y sin acciones
//   del despacho ya no se pueden convocar ni abrir juntas nuevas.
const RUTAS_LIBRES = [/^\/auth\//, /^\/billing\//, /^\/despacho\//, /^\/demo-solicitudes$/, /^\/vecinos\//, /^\/asistencia\//, /^\/meetings\/vecino\//];
const METODOS_LIBRES = new Set(['GET', 'HEAD', 'OPTIONS', 'DELETE']);

export async function exigirSuscripcionParaEscribir(req, res, next) {
  if (METODOS_LIBRES.has(req.method) || RUTAS_LIBRES.some((ruta) => ruta.test(req.path))) return next();

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(); // requireAuth de la propia ruta responde el 401

  let tenantId;
  try {
    tenantId = jwt.verify(token, process.env.JWT_SECRET).tenantId;
  } catch {
    return next();
  }

  try {
    const estado = await obtenerEstadoSuscripcion(tenantId);
    if (estado && !estado.accesoCompleto) {
      return res.status(402).json({
        error: MENSAJE_SIN_ACCESO[estado.estado] || MENSAJE_SIN_ACCESO.canceled,
        codigo: 'SUSCRIPCION_INACTIVA',
        estado: estado.estado
      });
    }
    next();
  } catch (error) {
    console.error('Error al comprobar la suscripción:', error.message);
    res.status(500).json({ error: 'No se pudo comprobar el estado de tu suscripción.' });
  }
}
