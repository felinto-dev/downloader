import { DOWNLOAD_CLIENT } from '@/adapters/tokens';
import { MAX_CONCURRENT_DOWNLOADS_ALLOWED } from '@/consts/app';
import {
  DOWNLOADS_ORCHESTRATING_QUEUE,
  DOWNLOADS_PROCESSING_QUEUE,
} from '@/consts/queues';
import { DownloadJobDto } from '@/dto/download.job.dto';
import { DownloadClientInterface } from '@/interfaces/download-client.interface';
import { DownloadsService } from '@/services/downloads.service';
import { HosterQuotasService } from '@/services/hoster-quotas.service';
import { HosterDownloadsConcurrencyValidator } from '@/validators/concurrent-hoster-downloads.validator';
import {
  InjectQueue,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DownloadStatus } from '@prisma/client';
import { Job, JobPromise, Queue } from 'bull';
import { DownloadsOrchestratorTasks } from './downloads-orchestrating.consumer';

@Processor(DOWNLOADS_PROCESSING_QUEUE)
export class DownloadsProcessingConsumer {
  constructor(
    @Inject(DOWNLOAD_CLIENT)
    private readonly downloadClient: DownloadClientInterface,
    private readonly configService: ConfigService,
    private readonly downloadsService: DownloadsService,
    private readonly hosterDownloadsConcurrencyValidator: HosterDownloadsConcurrencyValidator,
    @InjectQueue(DOWNLOADS_ORCHESTRATING_QUEUE)
    private readonly downloadsOrchestratingQueue: Queue,
    private readonly hosterQuotaService: HosterQuotasService,
  ) {}

  @OnQueueActive()
  async onDownloadStarted(job: Job<DownloadJobDto>, jobPromise: JobPromise) {
    const { hosterId } = job.data;
    const hasHosterReachedQuota = await this.hosterQuotaService.hasReachedQuota(
      hosterId,
    );
    const hasHosterReachedConcurrentDownloadsLimit =
      await this.hosterDownloadsConcurrencyValidator.hasReachedConcurrentDownloadsLimit(
        hosterId,
      );

    if (hasHosterReachedQuota || hasHosterReachedConcurrentDownloadsLimit) {
      jobPromise.cancel();
    }
  }

  @Process({ concurrency: MAX_CONCURRENT_DOWNLOADS_ALLOWED })
  async onDownload(job: Job<DownloadJobDto>) {
    const { url, downloadId, hosterId } = job.data;
    await this.hosterDownloadsConcurrencyValidator.incrementQuotaLeft(hosterId);
    await this.downloadsService.changeDownloadStatus(
      downloadId,
      hosterId,
      DownloadStatus.DOWNLOADING,
    );
    await this.downloadClient.download({
      downloadUrl: url,
      saveLocation: await this.configService.get('app.downloads_directory'),
      retry: 3,
      onDownloadProgress: (updatedDownloadProgress: number) =>
        job.progress(updatedDownloadProgress),
    });
  }

  @OnQueueFailed()
  async onDownloadFail(job: Job<DownloadJobDto>) {
    const { downloadId, hosterId } = job.data;
    await this.downloadsService.changeDownloadStatus(
      downloadId,
      hosterId,
      DownloadStatus.FAILED,
    );
    await this.hosterDownloadsConcurrencyValidator.decrementQuotaLeft(hosterId);
    await this.downloadsOrchestratingQueue.add(
      DownloadsOrchestratorTasks.RUN_ORCHESTRATOR,
    );
  }

  @OnQueueCompleted()
  async onDownloadFinished(job: Job<DownloadJobDto>) {
    const { downloadId, hosterId } = job.data;
    await this.downloadsService.changeDownloadStatus(
      downloadId,
      hosterId,
      DownloadStatus.SUCCESS,
    );
    await this.hosterDownloadsConcurrencyValidator.decrementQuotaLeft(hosterId);
    await this.downloadsOrchestratingQueue.add(
      DownloadsOrchestratorTasks.RUN_ORCHESTRATOR,
    );
  }
}
