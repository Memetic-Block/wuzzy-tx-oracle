import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AoService } from './ao.service'

@Module({
  imports: [ ConfigModule ],
  controllers: [],
  providers: [ AoService ],
  exports: [ AoService ]
})
export class AoModule {}
