import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Opprett default organisasjon (DTAX LIER)
  const org = await prisma.organization.upsert({
    where: { orgNumber: '936859356' },
    update: {},
    create: {
      name: 'DTAX LIER',
      orgNumber: '936859356',
      address: 'Moen 50',
      postalCode: '4333',
      city: 'OLTEDAL',
      country: 'NO',
      email: 'post@dtax.no',
      bankAccount: '3201.23.19997',
      isDefault: true,
      isActive: true,
    },
  });
  console.log('✅ Default organization created:', org.name);

  // Opprett admin-bruker
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dtax.no' },
    update: {},
    create: {
      email: 'admin@dtax.no',
      passwordHash,
      name: 'Administrator',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Opprett API-nøkkel for tax.salestext.no
  const apiKeyValue = 'tax_' + crypto.randomBytes(16).toString('hex');
  const apiSecret = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

  const apiKey = await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      name: 'tax.salestext.no',
      keyHash,
      secret: apiSecret,
      isActive: true,
    },
  });

  console.log('');
  console.log('========================================');
  console.log('🔑 API CREDENTIALS (LAGRE DISSE!)');
  console.log('========================================');
  console.log('API Key:', apiKeyValue);
  console.log('API Secret:', apiSecret);
  console.log('========================================');
  console.log('');

  // Opprett noen produkter
  const products = [
    { name: 'Skattemelding Standard', unitPrice: 990, vatRate: 0.25 },
    { name: 'Skattemelding Utvidet', unitPrice: 1990, vatRate: 0.25 },
    { name: 'Årsregnskap', unitPrice: 4990, vatRate: 0.25 },
    { name: 'MVA-oppgave', unitPrice: 590, vatRate: 0.25 },
    { name: 'Konsulenttjeneste', unitPrice: 1200, vatRate: 0.25, unit: 'time' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        id: p.name.toLowerCase().replace(/\s+/g, '-'),
        name: p.name,
        unitPrice: p.unitPrice,
        vatRate: p.vatRate,
        unit: p.unit || 'stk',
        organizationId: org.id,
      },
    });
  }
  console.log('✅ Products created');

  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Email: admin@dtax.no');
  console.log('  Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
