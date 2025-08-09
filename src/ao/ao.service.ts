import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JWKInterface } from '@ardrive/turbo-sdk/lib/types/common/jwk'
import {
  connect as aoConnect,
  createDataItemSigner,
  results as aoResults
} from '@permaweb/aoconnect'
import Arweave from 'arweave'
import fs from 'fs'

import { SendAosBaseOptions, sendAosMessage } from '../util/aos'

@Injectable()
export class AoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AoService.name)

  public readonly aosModuleId?: string
  public readonly aoCuUrl?: string
  public readonly aoMuUrl?: string
  public readonly aoGatewayUrl?: string
  public readonly aoGraphqlUrl?: string
  public readonly schedulerUnitAddress?: string
  public readonly messagingUnitAddress?: string
  public processId?: string

  private readonly oracleJwk: JWKInterface
  public oracleAddress: string
  private readonly ao: any

  constructor(private configService: ConfigService) {
    this.processId = this.configService.get<string>(
      'PROCESS_ID',
      { infer: true }
    )
    this.aoCuUrl = this.configService.get<string>(
      'AO_CU_URL',
      { infer: true }
    )
    this.aoMuUrl = this.configService.get<string>(
      'AO_MU_URL', { infer: true }
    )
    this.aoGatewayUrl = this.configService.get<string>(
      'AO_GATEWAY_URL', { infer: true }
    )
    this.aoGraphqlUrl = this.configService.get<string>(
      'AO_GRAPHQL_URL', { infer: true }
    )
    const schedulerUnitAddress = this.configService.get<string>(
      'SCHEDULER_UNIT_ADDRESS',
      { infer: true }
    )
    if (!schedulerUnitAddress) {
      throw new Error('SCHEDULER_UNIT_ADDRESS is not set!')
    }
    this.schedulerUnitAddress = schedulerUnitAddress
    this.logger.log(
      `Using Scheduler Unit Address [${this.schedulerUnitAddress}]`
    )
    const messagingUnitAddress = this.configService.get<string>(
      'MESSAGING_UNIT_ADDRESS',
      { infer: true }
    )
    if (!messagingUnitAddress) {
      throw new Error('MESSAGING_UNIT_ADDRESS is not set!')
    }
    this.messagingUnitAddress = messagingUnitAddress
    this.logger.log(
      `Using Messaging Unit Address [${this.messagingUnitAddress}]`
    )
    const aosModuleId = this.configService.get<string>(
      'AOS_MODULE_ID',
      { infer: true }
    )
    if (!aosModuleId) {
      throw new Error('AOS_MODULE_ID is not set!')
    }
    this.aosModuleId = aosModuleId
    this.logger.log(`Using AOS Module ID [${this.aosModuleId}]`)
    const ORACLE_JWK_PATH = this.configService.get<string>(
      'ORACLE_JWK_PATH',
      { infer: true }
    )
    if (!ORACLE_JWK_PATH) {
      throw new Error('ORACLE_JWK_PATH is not set!')
    }
    try {
      this.oracleJwk = JSON.parse(fs.readFileSync(ORACLE_JWK_PATH, 'utf-8'))
    } catch (error) {
      this.logger.error(
        `Failed to read ORACLE_JWK from path [${ORACLE_JWK_PATH}]`,
        error
      )
      throw error
    }
    this.logger.log(`Using Oracle wallet with public key [${ORACLE_JWK_PATH}]`)
    const aoConnectOptions = {
      CU_URL: this.aoCuUrl,
      MU_URL: this.aoMuUrl,
      GATEWAY_URL: this.aoGatewayUrl,
      GRAPHQL_URL: this.aoGraphqlUrl,
      MODE: 'legacy' as const
    }
    this.logger.log(
      `Connecting to AO with options: ${JSON.stringify(aoConnectOptions)}`
    )
    this.ao = aoConnect(aoConnectOptions)
  }

  async onApplicationBootstrap() {
    this.logger.log(`Bootstrapping, Arweave: [${typeof Arweave}]`)

    this.oracleAddress = await Arweave
      .init({})
      .wallets
      .jwkToAddress(this.oracleJwk)

    this.logger.log(`Bootstrapped with Oracle Address [${this.oracleAddress}]`)
  }

  private async spawnAoProcess() {
    if (this.processId) {
      this.logger.warn(
        `AO processId [${this.processId}] already exists, ` +
          `not spawning new AO process`
      )
      return
    }

    this.logger.log('Spawning new AO process')

    try {
      const processId = await this.ao.spawn({
        module: this.aosModuleId,
        scheduler: this.schedulerUnitAddress,
        signer: createDataItemSigner(this.oracleJwk),
        tags: [
          { name: 'Authority', value: this.messagingUnitAddress },
          { name: 'App-Name', value: 'Wuzzy-Transaction-Oracle' }
        ]
      })

      if (typeof processId === 'string') {
        this.logger.log(`Spawned AO process with ID [${processId}]`)
        this.processId = processId
      }
    } catch (error) {
      this.logger.error('Failed to spawn AO process', error)
      throw error
    }
  }

  public async results(
    processId: string | undefined = this.processId,
    opts: {
      sort?: 'ASC' | 'DESC',
      limit?: number,
      from?: string
    } = { sort: 'ASC', limit: 25 }
  ) {
    if (!processId) {
      this.logger.error('No AO processId found, cannot fetch results')
      return
    }

    this.logger.log(`Fetching results for AO processId [${processId}]`)
    return aoResults({ process: processId, ...opts })    
  }

  public async sendAosMessage(
    { processId, data, tags }: SendAosBaseOptions
  ): Promise<string> {
    return await this.ao.message({
      process: processId,
      tags,
      data,
      signer: createDataItemSigner(this.oracleJwk)
    })
  }
}
