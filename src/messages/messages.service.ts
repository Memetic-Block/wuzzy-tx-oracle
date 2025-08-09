import { InjectQueue } from '@nestjs/bullmq'
import { forwardRef, Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Queue } from 'bullmq'
import { GraphQLClient } from 'graphql-request'
import { In, IsNull, Not, Repository } from 'typeorm'
import _ from 'lodash'

import { AoService } from '../ao/ao.service'
import IncomingMessageGQL from './schema/incoming-message.gql'
import { TransactionsResponse } from './schema/transaction.types'
import { IncomingMessage } from './schema/incoming-message.entity'
import { TxOracleService } from '../tx-oracle/tx-oracle.service'

@Injectable()
export class MessagesService implements OnApplicationBootstrap {
  static CHECK_INCOMING_MESSAGES_QUEUE_NAME = 'check-incoming-messages-queue'
  static CHECK_INCOMING_MESSAGES_JOB_NAME = 'check-incoming-messages'
  static CHECK_INCOMING_MESSAGES_JOB_DELAY = 1000 * 60 // 1 Minute
  static SEND_MESSAGES_QUEUE_NAME = 'send-messages-queue'
  static SEND_MESSAGES_JOB_NAME = 'send-messages'
  static ACTIONS = [ 'Get-Block', 'Get-Transaction', 'Get-Data' ]

  private readonly logger = new Logger(MessagesService.name)
  private readonly isLive?: string
  private readonly doClean?: string
  private readonly doDbNuke?: string
  private readonly gqlEndpoint: string
  private readonly gql: GraphQLClient
  private readonly processAllowlist: string[]

  public latestMessageCursor?: string

  constructor(
    private readonly config: ConfigService<{
      IS_LIVE: string
      DO_CLEAN: string
      DO_DB_NUKE: string
      GQL_ENDPOINT: string
      PROCESS_ALLOWLIST: string
    }>,
    @InjectQueue(MessagesService.CHECK_INCOMING_MESSAGES_QUEUE_NAME)
    private readonly checkIncomingMessagesQueue: Queue,
    private readonly aoService: AoService,
    @InjectRepository(IncomingMessage)
    private readonly incomingMessageRepository: Repository<IncomingMessage>,
    @Inject(forwardRef(() => TxOracleService))
    private readonly txOracleService: TxOracleService
  ) {
    this.isLive = this.config.get<string>('IS_LIVE', { infer: true })
    this.doClean = this.config.get<string>('DO_CLEAN', { infer: true })
    this.doDbNuke = this.config.get<string>('DO_DB_NUKE', { infer: true })
    this.logger.log(
      `Initializing with IS_LIVE [${this.isLive}], ` +
        `DO_CLEAN [${this.doClean}], DO_DB_NUKE [${this.doDbNuke}]`
    )
    this.gqlEndpoint = this.config.get<string>(
      'GQL_ENDPOINT',
      { infer: true }
    ) || ''
    if (!this.gqlEndpoint) {
      throw new Error('GQL_ENDPOINT is not set!')
    }
    this.logger.log(`Using GraphQL Endpoint [${this.gqlEndpoint}]`)
    this.gql = new GraphQLClient(this.gqlEndpoint)
    this.processAllowlist = this.config.get<string>(
      'PROCESS_ALLOWLIST',
      '',
      { infer: true }
    ).split(',').map(item => item.trim())
    this.logger.log(
      `Using Process Allowlist [${JSON.stringify(this.processAllowlist)}]`
    )
  }

  async onApplicationBootstrap() {
    if (this.doClean === 'true') {
      this.logger.log(
        `Cleaning up ${MessagesService.CHECK_INCOMING_MESSAGES_QUEUE_NAME} because DO_CLEAN is true`
      )
      await this.checkIncomingMessagesQueue.obliterate({ force: true })
    }

    if (this.doDbNuke === 'true') {
      this.logger.log(
        `TODO -> Cleaning up DB because DO_DB_NUKE is true`
      )
    }

    this.logger.log(`Enqueuing immediate check incoming messages job`)
    await this.enqueueCheckIncomingMessages({ delayJob: 0 })
  }

  async enqueueCheckIncomingMessages(opts: { delayJob: number }) {
    this.logger.log(
      `Enqueuing check incoming messages job with delay [${opts.delayJob}]`
    )
    await this.checkIncomingMessagesQueue.add(
      MessagesService.CHECK_INCOMING_MESSAGES_JOB_NAME,
      {},
      { delay: opts.delayJob }
    )
  }

  async readMessages(
    opts: {
      limit?: number,
      cursor?: string,
      sortOrder?: 'HEIGHT_ASC' | 'INGESTED_AT_DESC'
      entityId?: string
    } = {
      limit: 100,
      cursor: '',
      sortOrder: 'HEIGHT_ASC',
      entityId: this.aoService.oracleAddress
    }
  ) {
    if (!opts.limit) { opts.limit = 100 }
    if (!opts.cursor) { opts.cursor = '' }
    if (!opts.sortOrder) { opts.sortOrder = 'HEIGHT_ASC' }
    if (!opts.entityId) { opts.entityId = this.aoService.oracleAddress }

    this.logger.log(`Fetching messages for [${opts.entityId}]`)
    try {
      const { transactions } = await this.gql.request<TransactionsResponse>(
        IncomingMessageGQL,
        opts
      )
      this.logger.log(`Got [${transactions.edges.length}] messages`)
      return transactions.edges
    } catch (error) {
      this.logger.error(`Failed to read messages: ${error.message}`, error)
    }

    return []
  }

  async checkNewMessages() {
    this.logger.log(`Checking for new messages`)

    let latestMessageCursor = this.latestMessageCursor
    if (!latestMessageCursor) {
      this.logger.log(
        `Missing latest message cursor, fetching latest message from DB`
      )
      const latestMessage = await this.incomingMessageRepository.find({
        where: { blockHeight: Not(IsNull()) },
        order: { blockHeight: 'DESC' },
        take: 1
      })
      this.logger.log(
        `Latest block height in DB [${latestMessage?.[0]?.blockHeight}] ` +
          `with cursor [${latestMessage?.[0]?.cursor}]`
      )
      latestMessageCursor = latestMessage?.[0]?.cursor
    }

    const messages = await this.readMessages({ cursor: latestMessageCursor })

    // this.logger.debug(`Messages = ${JSON.stringify(messages, null, 2)}`)

    // NB: We only care about messages to this oracle's address, from the MU,
    //     the process ID is in the allowlist, & it's an Action we can process
    const validMessages = messages.filter(message =>
      message.node.recipient === this.aoService.oracleAddress &&
        message.node.owner.address === this.aoService.messagingUnitAddress &&
        this.processAllowlist.includes(
          message
            .node
            .tags
            .find(tag => tag.name === 'From-Process')?.value || ''
        ) &&
        MessagesService.ACTIONS.includes(
          message.node.tags.find(tag => tag.name === 'Action')?.value || ''
        )
    )
    this.logger.debug(
      `Got [${validMessages.length}] valid messages during check`
    )
    const uniqueMessages = _.uniqBy(validMessages, message => message.node.id)
    this.logger.debug(
      `Got [${uniqueMessages.length}] unique messages during check`
    )
    const existingMessages = await this.incomingMessageRepository.findBy({
      transactionId: In(uniqueMessages.map(msg => msg.node.id))
    })
    this.logger.debug(
      `Found [${existingMessages.length}] existing messages during check`
    )
    const newMessages = _.differenceBy(
      uniqueMessages,
      existingMessages,
      msg => msg instanceof IncomingMessage ? msg.transactionId : msg.node.id
    )
    this.logger.log(`Got [${newMessages.length}] new messages during check`)

    if (newMessages.length > 0) {
      const newIncomingMessages = newMessages.map(
        msg => new IncomingMessage({
          transactionId: msg.node.id,
          recipient: msg.node.recipient,
          from: msg.node.tags.find(
            tag => tag.name === 'From-Process'
          )?.value || '',
          blockHeight: msg.node.block?.height,
          blockTimestamp: msg.node.block?.timestamp,
          cursor: msg.cursor,
          transaction: msg.node,
          isProcessed: false
        })
      )
      await this.incomingMessageRepository.insert(newIncomingMessages)

      for (const msg of newIncomingMessages) {
        switch (
          msg.transaction.tags.find(tag => tag.name === 'Action')?.value
        ) {
          case 'Get-Block':
          case 'Get-Transaction':
          case 'Get-Data':
            await this.txOracleService.enqueueProcessTxOracleRequest(
              msg,
              { delayJob: 0 }
            )
            break
          default:
            this.logger.warn(
              `Unknown action type for message [${msg.transactionId}]`
            )
        }
      }
    }

    if (messages.length > 0) {
      const latestMessage = messages.reduce((latest, msg) => {
        if (
          msg.node.block &&
            msg.node.block.height > (latest?.node?.block?.height || 0)
        ) {
          return msg
        }
        return latest
      }, messages[0])
      if (latestMessage.node.block?.height) {
        this.logger.log(
          `Remembering latest message height ` +
            `[${latestMessage.node.block?.height}] & ` +
            `cursor [${latestMessage.cursor}]`
        )
        this.latestMessageCursor = latestMessage.cursor
      }
    }
  }

  async markMessageProcessed(transactionId: string, replyMessageId: string) {
    this.logger.log(
      `Marking message [${transactionId}] as processed with ` +
        `reply [${replyMessageId}]`
    )
    await this.incomingMessageRepository.update(
      { transactionId },
      {
        isProcessed: true,
        replyMessageId
      }
    )
  }
}
