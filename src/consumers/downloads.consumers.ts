import {
  InjectQueue,
  OnQueueCompleted,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { DOWNLOADS_QUEUE } from '@/consts/queues';
import { DownloadsService } from '@/services/downloads.service';
import { GLOBAL_DOWNLOADS_CONCURRENCY } from '@/consts/app';
import { HostersService } from '@/services/hosters.service';
import { DownloadsRepository } from '@/repositories/downloads.repository';

@Processor(DOWNLOADS_QUEUE)
export class DownloadsConsumer {
  private readonly logger = new Logger(DownloadsConsumer.name);

  constructor(
    @InjectQueue(DOWNLOADS_QUEUE) private readonly queue: Queue,
    private readonly downloadsService: DownloadsService,
    private readonly hostersService: HostersService,
    private readonly downloadsRepository: DownloadsRepository,
  ) {}

  private async jobsActiveQuotaLeft() {
    return GLOBAL_DOWNLOADS_CONCURRENCY - (await this.queue.getActiveCount());
  }

  @Cron(CronExpression.EVERY_HOUR)
  async pullJobs() {
    this.logger.verbose('Pulling jobs to queue from Database...');
    if ((await this.jobsActiveQuotaLeft()) >= 1) {
      for (const hoster of await this.hostersService.getInactiveHostersWithQuotaLeft()) {
        await this.addHosterDownloadsRequestsToQueue(
          hoster.id,
          hoster.quotaLeft,
        );
      }
    }
  }

  private async addHosterDownloadsRequestsToQueue(
    hosterId: string,
    quotaLeft: number,
  ) {
    const hosterQuota = Math.min(quotaLeft, await this.jobsActiveQuotaLeft());

    if (hosterQuota >= 1) {
      const jobs = await this.downloadsRepository.getPendingDownloadsByHosterId(
        hosterId,
        hosterQuota,
      );
      this.logger.verbose(
        `adding jobs for ${hosterId}... ${JSON.stringify(jobs)}`,
      );
      // add job bulk
    }
  }

  @Process({ concurrency: GLOBAL_DOWNLOADS_CONCURRENCY })
  async doDownload(job: Job) {
    // add download attempt
    // download status = downloading

    await this.downloadsService.download({
      url: job.data.url,
      onDownloadProgress: (updatedDownloadProgress: number) =>
        job.progress(updatedDownloadProgress),
    });
  }

  @OnQueueCompleted()
  async pullNextJob() {
    // TODO: Should pull new jobs to queue respecting the limits for each hoster.
    // If no download requests meet the criteria, do nothing
    this.logger.verbose('Download finished!');
    this.logger.verbose('Downloading new item for current hoster...');
  }
}
