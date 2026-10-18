// Usuarios por defecto. Se ejecuta con "pnpm db:seed" (o solo tras "prisma migrate reset").
// Es idempotente: si el correo ya existe actualiza nombre y rol, y no toca la contraseña.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Rol } from '../src/generated/prisma/client';

const PASSWORD = process.env.SEED_PASSWORD?.trim() || 'Andres1234*';

// Plantillas iniciales (se crean una sola vez, por nombre; luego el equipo las edita en la app).
const PLANTILLAS: { nombre: string; canal: 'EMAIL' | 'WHATSAPP' | 'LLAMADA'; asunto?: string; cuerpo: string }[] = [
  {
    nombre: 'Correo · primer contacto',
    canal: 'EMAIL',
    asunto: 'Una propuesta para {{nombre}}',
    cuerpo: `Hola, equipo de {{nombre}}:

Soy {{remitente}}, de {{empresa}}. Trabajamos con {{categoria}} en {{municipio}} y creemos que podemos ayudarles a conseguir más clientes.

¿Les parece si les cuento en una llamada de 10 minutos esta semana? Pueden responder a este correo con el día y la hora que les quede mejor.

Saludos,
{{remitente}}`,
  },
  {
    nombre: 'Correo · seguimiento',
    canal: 'EMAIL',
    asunto: 'Seguimiento: propuesta para {{nombre}}',
    cuerpo: `Hola de nuevo, equipo de {{nombre}}:

Les escribí hace unos días sobre cómo {{empresa}} puede ayudar a {{categoria}} en {{municipio}}. ¿Tuvieron oportunidad de verlo?

Si no es el momento, me cuentan y no les escribo más.

Saludos,
{{remitente}}`,
  },
  {
    nombre: 'WhatsApp · primer contacto',
    canal: 'WHATSAPP',
    cuerpo: `Hola, ¿hablo con alguien de {{nombre}}? Soy {{remitente}}, de {{empresa}}. Ayudamos a {{categoria}} en {{municipio}} a conseguir más clientes. ¿Les puedo contar en 2 minutos cómo funciona? Si prefieren no recibir mensajes, respondan NO y no les escribo más.`,
  },
  {
    nombre: 'Llamada · guion corto',
    canal: 'LLAMADA',
    cuerpo: `1. Saludo: "Buenos días, ¿hablo con alguien de {{nombre}}? Mi nombre es {{remitente}}, de {{empresa}}."
2. Motivo: "Trabajamos con {{categoria}} en {{municipio}} y quería contarle en un minuto cómo les ayudamos a conseguir más clientes."
3. Pregunta: "¿Con quién puedo hablar sobre esto? ¿Le puedo enviar la información por correo o WhatsApp?"
4. Si no le interesa: agradecer y marcar "No interesado". Si pide no volver a llamar: "No volver a contactar".`,
  },
];

const USUARIOS: { email: string; fullName: string; rol: Rol }[] = [
  { email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' },
  { email: 'camila@gmail.com', fullName: 'Camila Rojas', rol: 'SERVICE' },
  { email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en el .env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const u of USUARIOS) {
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      await prisma.usuario.upsert({
        where: { email: u.email },
        create: { ...u, passwordHash },
        update: { fullName: u.fullName, rol: u.rol },
      });
      console.log(`✔ ${u.rol.padEnd(7)} ${u.email} (${u.fullName})`);
    }
    for (const p of PLANTILLAS) {
      const existe = await prisma.plantilla.findFirst({ where: { nombre: p.nombre } });
      if (existe) continue;
      await prisma.plantilla.create({ data: { ...p, asunto: p.asunto ?? null } });
      console.log(`✔ plantilla ${p.nombre}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
