import { Processor, WorkerHost } from '@nestjs/bullmq'
import { forwardRef, Inject, Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { TxOracleService } from '../tx-oracle.service'
import { IncomingMessage } from '../../messages/schema/incoming-message.entity'

@Processor(TxOracleService.QUEUE_NAME)
export class TxOracleQueue extends WorkerHost {
  private readonly logger = new Logger(TxOracleQueue.name)

  constructor(@Inject(forwardRef(() => TxOracleService))
  private readonly txOracleService: TxOracleService) {
    super()
  }

  async process(job: Job<IncomingMessage>) {
    this.logger.log(`Processing job [${job.name}] with id [${job.id}]`)

    switch (job.name) {
      case TxOracleService.JOB_NAME:
        try {
          await this.txOracleService.processTxOracleRequest(job.data)
        } catch (error) {
          this.logger.error(
            `Error processing job [${job.name}] with id [${job.id}]: ` +
              error.message,
            error
          )
        }

        return
      default:
        this.logger.warn(`Unknown job [${job.name}] with id [${job.id}]`)
        return undefined
    }
  }
}
