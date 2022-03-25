import { DownloadsRepository } from './downloads.repository';
import { HostersLimitsRepository } from './hosters-limit.repository';
import { HostersRepository } from './hosters.repository';

export const REPOSITORIES = [
  HostersRepository,
  HostersLimitsRepository,
  DownloadsRepository,
];
