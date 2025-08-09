import { forwardRef, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import { MessagesService } from './messages.service'
import {
  CheckIncomingMessagesQueue
} from './processors/check-incoming-messages.queue'
import { AoModule } from '../ao/ao.module'
import { IncomingMessage } from './schema/incoming-message.entity'
import { TxOracleModule } from 'src/tx-oracle/tx-oracle.module'

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: MessagesService.CHECK_INCOMING_MESSAGES_QUEUE_NAME,
      streams: { events: { maxLen: 2000 } }
    }),
    TypeOrmModule.forFeature([ IncomingMessage ]),
    AoModule,
    forwardRef(() => TxOracleModule)
  ],
  controllers: [],
  providers: [ MessagesService, CheckIncomingMessagesQueue ],
  exports: [ MessagesService ]
})
export class MessagesModule {}
