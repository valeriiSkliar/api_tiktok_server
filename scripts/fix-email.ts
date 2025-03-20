import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await prisma.email.update({
      where: { id: 1 },
      data: {
        username: 'valeriisklyarov@ukr.net',
        email_address: 'valeriisklyarov@ukr.net',
      },
    });

    console.log('Updated email account:', result);
  } catch (error) {
    console.error('Error updating email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
