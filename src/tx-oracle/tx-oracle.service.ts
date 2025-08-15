import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bullmq'
import { HttpService } from '@nestjs/axios'
import { AxiosError } from 'axios'
import { Queue } from 'bullmq'
import { arGql } from 'ar-gql'
import { GQLNodeInterface } from 'ar-gql/dist/faces'

import { AoService } from '../ao/ao.service'
import { IncomingMessage } from '../messages/schema/incoming-message.entity'
import { MessagesService } from '../messages/messages.service'

@Injectable()
export class TxOracleService implements OnApplicationBootstrap {
  static QUEUE_NAME = 'tx-oracle-process-queue'
  static JOB_NAME = 'tx-oracle-process-request'
  static ERROR_FETCHING_BLOCK = 'Error fetching block'
  static ERROR_FETCHING_TRANSACTION = 'Error fetching transaction'
  static ERROR_FETCHING_DATA = 'Error fetching data'

  private readonly logger = new Logger(TxOracleService.name)
  private readonly gatewayUrl: string
  private readonly arGql = arGql()

  constructor(
    private config: ConfigService<{
      GATEWAY_URL: string
    }>,
    private readonly aoService: AoService,
    @InjectQueue(TxOracleService.QUEUE_NAME)
    private readonly txOracleQueue: Queue,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService
  ) {
    this.gatewayUrl = this.config.get<string>(
      'GATEWAY_URL',
      'https://arweave.net',
      { infer: true }
    )
  }

  async onApplicationBootstrap() {
    this.logger.log('Bootstrapping')
    this.logger.log(`Bootstrapped`)
  }

  async enqueueProcessTxOracleRequest(
    message: IncomingMessage,
    opts: { delayJob: number }
  ) {
    this.logger.log(
      `Enqueuing Process TX Oracle Request for message ` +
      `[${message.transactionId}] with delay [${opts.delayJob}]`
    )
    await this.txOracleQueue.add(
      TxOracleService.JOB_NAME,
      message,
      { delay: opts.delayJob }
    )
  }

  async processTxOracleRequest(message: IncomingMessage) {
    this.logger.log(
      `Processing TX Oracle Request for message [${message.transactionId}]`
    )

    const actionTag = message.transaction.tags.find(
      tag => tag.name === 'Action'
    )?.value
    let result: null | GQLNodeInterface | string = null
    let replyTag = ''
    let idTagName = ''
    let idTagValue = ''
    let errorMessage = ''
    switch (actionTag) {
      case 'Get-Block':
        replyTag = 'Get-Block-Result'
        const height = parseInt(
          message.transaction.tags.find(tag => tag.name === 'Block-Height')
            ?.value || 'NaN'
        )
        if (Number.isNaN(height)) {
          errorMessage = TxOracleService.ERROR_FETCHING_BLOCK
        } else {
          result = await this.getBlock(height)
          idTagName = 'Block-Height'
          idTagValue = height.toString()
          if (TxOracleService.ERROR_FETCHING_BLOCK === result) {
            errorMessage = TxOracleService.ERROR_FETCHING_BLOCK
          }
        }
        break
      case 'Get-Transaction':
        replyTag = 'Get-Transaction-Result'
        const txId = message.transaction.tags.find(
          tag => tag.name === 'Transaction-Id'
        )?.value
        if (!txId) {
          errorMessage = TxOracleService.ERROR_FETCHING_TRANSACTION
        } else {
          result = await this.getTransaction(txId)
          idTagName = 'Transaction-Id'
          idTagValue = txId
          if (TxOracleService.ERROR_FETCHING_TRANSACTION === result) {
            errorMessage = TxOracleService.ERROR_FETCHING_TRANSACTION
          }
        }
        break
      case 'Get-Data':
        replyTag = 'Get-Data-Result'
        const dataTxId = message.transaction.tags.find(
          tag => tag.name === 'Transaction-Id'
        )?.value
        if (!dataTxId) {
          errorMessage = TxOracleService.ERROR_FETCHING_DATA
        } else {
          result = await this.getData(dataTxId)
          idTagName = 'Transaction-Id'
          idTagValue = dataTxId
          if (TxOracleService.ERROR_FETCHING_DATA === result) {
            errorMessage = TxOracleService.ERROR_FETCHING_DATA
          }
        }
        break
      default:
        this.logger.warn(
          `Unknown Action for message [${message.transactionId}] ` +
            `for Action [${actionTag}]`
        )
        return
    }

    const data = typeof result === 'string'
      ? result
      : typeof result === 'object'
        ? JSON.stringify(result)
        : undefined
    const tags = [{ name: 'Action', value: replyTag }]
    if (errorMessage) {
      tags.push({ name: 'Error', value: errorMessage })
    }
    if (idTagName && idTagValue) {
      tags.push({ name: idTagName, value: idTagValue })
    }
    const replyMessageId = await this.aoService.sendAosMessage({
      processId: message.from,
      data,
      tags
    })
    await this.messagesService.markMessageProcessed(
      message.transactionId,
      replyMessageId
    )

    this.logger.log(
      `Processed TX Oracle Request for transaction [${message.transactionId}]`
    )
  }

  async getBlock(height: number) {
    this.logger.log(`Fetching block at height [${height}]`)
    try {
      const response = await this.httpService.axiosRef.get(
        `${this.gatewayUrl}/block/height/${height}`
      )
      return response.data
    } catch (error) {
      if (error instanceof AxiosError && error.status === 404) {
        return null
      } else {
        this.logger.error(
          `Failed to fetch block at height [${height}]: ${error.message}`
        )
      }
      return TxOracleService.ERROR_FETCHING_BLOCK
    }
  }

  async getTransaction(
    transactionId: string
  ): Promise<GQLNodeInterface | null | string> {
    this.logger.log(`Fetching transaction [${transactionId}]`)
    try {
      return await this.arGql.tx(transactionId)
    } catch (error) {
      this.logger.error(
        `Failed to fetch transaction [${transactionId}]: ${error.message}`,
        error
      )
      return TxOracleService.ERROR_FETCHING_TRANSACTION
    }
  }

  async getData(transactionId: string) {
    this.logger.log(`Fetching data for transaction [${transactionId}]`)
    try {
      const response = await this.httpService.axiosRef.get(
        `${this.gatewayUrl}/raw/${transactionId}`
      )
      return response.data
    } catch (error) {
      if (error instanceof AxiosError && error.status === 404) {
        return null
      } else {
        this.logger.error(
          `Failed to fetch data for transaction [${transactionId}]: ` +
            error.message
        )
      }
      return TxOracleService.ERROR_FETCHING_DATA
    }
  }
}
