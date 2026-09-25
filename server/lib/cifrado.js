import crypto from 'crypto';

// Cifrado simétrico (AES-256-GCM) para secretos que VotifAI tiene que poder
// volver a leer, como la contraseña SMTP del buzón de un despacho. La clave
// sale de CORREOS_CLAVE_CIFRADO (cualquier texto largo y aleatorio; se
// deriva a 32 bytes con SHA-256). Si se pierde o cambia esa variable, los
// buzones guardados dejan de poder usarse y hay que volver a conectarlos.

function clave() {
  const secreto = process.env.CORREOS_CLAVE_CIFRADO;
  if (!secreto || secreto.length < 32) {
    throw new Error('Falta CORREOS_CLAVE_CIFRADO (mínimo 32 caracteres) en la configuración del servidor.');
  }
  return crypto.createHash('sha256').update(secreto).digest();
}

// Formato: v1:<iv>:<tag>:<cifrado>, todo en base64.
export function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), cifrado.toString('base64')].join(':');
}

export function descifrar(valor) {
  const [version, iv, tag, cifrado] = String(valor).split(':');
  if (version !== 'v1' || !iv || !tag || !cifrado) throw new Error('Secreto cifrado con un formato desconocido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]).toString('utf8');
}
