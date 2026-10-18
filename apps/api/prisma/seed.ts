// Default users. Run with "pnpm db:seed" (or only after "prisma migrate reset").
// It is idempotent: if the email already exists it updates the name and role, and does not touch the password.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Role } from '../src/generated/prisma/client';

const PASSWORD = process.env.SEED_PASSWORD?.trim() || 'Andres1234*';

// Initial templates (created only once, by name; then the team edits them in the app).
const TEMPLATES: { name: string; channel: 'EMAIL' | 'WHATSAPP' | 'CALL'; subject?: string; body: string }[] = [
  {
    name: 'Correo · primer contacto',
    channel: 'EMAIL',
    subject: 'Una propuesta para {{nombre}}',
    body: `Hola, equipo de {{nombre}}:

Soy {{remitente}}, de {{empresa}}. Trabajamos con {{categoria}} en {{municipio}} y creemos que podemos ayudarles a conseguir más clientes.

¿Les parece si les cuento en una llamada de 10 minutos esta semana? Pueden responder a este correo con el día y la hora que les quede mejor.

Saludos,
{{remitente}}`,
  },
  {
    name: 'Correo · seguimiento',
    channel: 'EMAIL',
    subject: 'Seguimiento: propuesta para {{nombre}}',
    body: `Hola de nuevo, equipo de {{nombre}}:

Les escribí hace unos días sobre cómo {{empresa}} puede ayudar a {{categoria}} en {{municipio}}. ¿Tuvieron oportunidad de verlo?

Si no es el momento, me cuentan y no les escribo más.

Saludos,
{{remitente}}`,
  },
  {
    name: 'WhatsApp · primer contacto',
    channel: 'WHATSAPP',
    body: `Hola, ¿hablo con alguien de {{nombre}}? Soy {{remitente}}, de {{empresa}}. Ayudamos a {{categoria}} en {{municipio}} a conseguir más clientes. ¿Les puedo contar en 2 minutos cómo funciona? Si prefieren no recibir mensajes, respondan NO y no les escribo más.`,
  },
  {
    name: 'Llamada · guion corto',
    channel: 'CALL',
    body: `1. Saludo: "Buenos días, ¿hablo con alguien de {{nombre}}? Mi nombre es {{remitente}}, de {{empresa}}."
2. Motivo: "Trabajamos con {{categoria}} en {{municipio}} y quería contarle en un minuto cómo les ayudamos a conseguir más clientes."
3. Pregunta: "¿Con quién puedo hablar sobre esto? ¿Le puedo enviar la información por correo o WhatsApp?"
4. Si no le interesa: agradecer y marcar "No interesado". Si pide no volver a llamar: "No volver a contactar".`,
  },
];

const USERS: { email: string; fullName: string; role: Role }[] = [
  { email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' },
  { email: 'camila@gmail.com', fullName: 'Camila Rojas', role: 'SERVICE' },
  { email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing in .env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const u of USERS) {
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      await prisma.user.upsert({
        where: { email: u.email },
        create: { ...u, passwordHash },
        update: { fullName: u.fullName, role: u.role },
      });
      console.log(`✔ ${u.role.padEnd(7)} ${u.email} (${u.fullName})`);
    }
    for (const p of TEMPLATES) {
      const exists = await prisma.template.findFirst({ where: { name: p.name } });
      if (exists) continue;
      await prisma.template.create({ data: { ...p, subject: p.subject ?? null } });
      console.log(`✔ template ${p.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
