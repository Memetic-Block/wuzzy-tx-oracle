import { Processor, WorkerHost } from '@nestjs/bullmq'
import { forwardRef, Inject, Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { MessagesService } from '../messages.service'

@Processor(MessagesService.SEND_MESSAGES_QUEUE_NAME)
export class SendMessagesQueue extends WorkerHost {
  private readonly logger = new Logger(SendMessagesQueue.name)

  constructor(
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService
  ) {
    super()
  }

  async process(job: Job) {
    this.logger.log(`Processing job [${job.name}] with id [${job.id}]`)

    switch (job.name) {
      case MessagesService.SEND_MESSAGES_JOB_NAME:
        try {
          // await this.messagesService.sendMessages()
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
