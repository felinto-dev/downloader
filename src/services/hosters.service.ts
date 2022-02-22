import { DateTime } from 'luxon';
import { Injectable } from '@nestjs/common';

import { HostersRepository } from '@/repositories/hosters.repository';
import { HostersLimitsRepository } from '@/repositories/hosters-limit.repository';
import {
  getMinValueFromObjectValues,
  isObjectEmpty,
  subtractObjects,
} from '@/utils/objects';

@Injectable()
export class HostersService {
  constructor(
    private readonly hostersRepository: HostersRepository,
    private readonly hostersLimitsRepository: HostersLimitsRepository,
  ) {}

  async getInactiveHostersWithQuotaLeft() {
    const hosters = await this.hostersRepository.getInactiveHosters();
    return Promise.all(
      hosters.map(async (hoster) => ({
        id: hoster.id,
        quotaLeft: Math.min(
          hoster.concurrency,
          getMinValueFromObjectValues(
            await this.getHosterLimitsQuotaLeft(hoster.id),
          ),
        ),
      })),
    );
  }

  async getHosterLimitsQuotaLeft(hosterId: string) {
    const hosterLimits = await this.hostersLimitsRepository.getHosterLimits(
      hosterId,
    );
    const downloadsAttempts = await this.countHosterDownloadsAttempts(hosterId);

    // TODO: A Hoster Limits object can be created without hourly limits, etc.
    if (hosterLimits && !isObjectEmpty(hosterLimits)) {
      return subtractObjects(hosterLimits, downloadsAttempts);
    }
  }

  async countHosterDownloadsAttempts(hosterId: string) {
    return {
      hourly:
        await this.hostersLimitsRepository.countHosterDownloadsAttemptsDidAfter(
          hosterId,
          DateTime.now().set({ minute: 0, second: 0 }).toISO(),
        ),
      daily:
        await this.hostersLimitsRepository.countHosterDownloadsAttemptsDidAfter(
          hosterId,
          DateTime.now().set({ hour: 0, minute: 0, second: 0 }).toISO(),
        ),
      monthly:
        await this.hostersLimitsRepository.countHosterDownloadsAttemptsDidAfter(
          hosterId,
          DateTime.now().set({ day: 1, hour: 0, minute: 0, second: 0 }).toISO(),
        ),
    };
  }
}
