import { HosterLimits } from '@/dto/hoster-limits.dto';
import { PrismaService } from '@/prisma.service';
import { startOfDay, startOfHour, startOfMonth } from '@/utils/date';
import { Injectable } from '@nestjs/common';
import { PrismaPromise } from '@prisma/client';

@Injectable()
export class HostersLimitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getQuotasByHosterId(hosterId: string) {
    return this.prisma.hosterLimit.findUnique({
      where: { hosterId },
      select: { hourly: true, daily: true, monthly: true },
    });
  }

  countUsedDownloadsQuotaByPeriod(
    hosterId: string,
    date: string,
  ): PrismaPromise<number> {
    return this.prisma.download.count({
      where: {
        status: { in: ['DOWNLOADING', 'FAILED', 'SUCCESS'] },
        Hoster: { id: hosterId },
        updatedAt: { gte: date },
      },
    });
  }

  async countUsedDownloadsQuota(hosterId: string): Promise<HosterLimits> {
    const [monthly, daily, hourly] = await this.prisma.$transaction([
      this.countUsedDownloadsQuotaByPeriod(hosterId, startOfMonth()),
      this.countUsedDownloadsQuotaByPeriod(hosterId, startOfDay()),
      this.countUsedDownloadsQuotaByPeriod(hosterId, startOfHour()),
    ]);
    return { monthly, daily, hourly };
  }
}
