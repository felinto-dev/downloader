import { PrismaClient } from '@prisma/client';
import { downloads } from './downloads';
import { hosters } from './hosters';
const prisma = new PrismaClient();

async function main() {
  const hostersTransactions = [
    ...hosters.map((hoster) => {
      return prisma.hoster.upsert({
        where: { id: hoster.id },
        update: {},
        create: hoster,
      });
    }),
  ];

  const downloadsTransactions = [
    ...downloads.map((download) => {
      return prisma.download.upsert({
        where: {
          downloadIdByHoster: {
            downloadId: download.downloadId,
            hosterId: download.Hoster.connect.id,
          },
        },
        update: {},
        create: download,
      });
    }),
  ];

  await prisma.$transaction([...hostersTransactions, ...downloadsTransactions]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
