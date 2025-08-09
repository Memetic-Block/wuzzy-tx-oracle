import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { HttpModule } from '@nestjs/axios'

import { TxOracleService } from './tx-oracle.service'
import { AoModule } from '../ao/ao.module'
import { MessagesModule } from '../messages/messages.module'
import { TxOracleQueue } from './processors/tx-oracle.queue'

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: TxOracleService.QUEUE_NAME,
      streams: { events: { maxLen: 2000 } }
    }),
    HttpModule,
    AoModule,
    forwardRef(() => MessagesModule)
  ],
  controllers: [],
  providers: [ TxOracleService, TxOracleQueue ],
  exports: [ TxOracleService ]
})
export class TxOracleModule {}
