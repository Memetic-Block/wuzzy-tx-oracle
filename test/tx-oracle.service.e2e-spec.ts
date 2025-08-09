import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { Queue } from 'bullmq'
import axios from 'axios'

import { TxOracleService } from '../src/tx-oracle/tx-oracle.service'
import { AoService } from 'src/ao/ao.service'

describe('TxOracleService', () => {
  let txOracleService: TxOracleService

  beforeEach(async () => {
    const configMock = {
      get: () => 'https://arweave.net'
    } as unknown as ConfigService
    const aoMock = {} as unknown as AoService
    const queueMock = {} as unknown as Queue
    const httpMock = { axiosRef: axios } as unknown as HttpService
    txOracleService = new TxOracleService(
      configMock,
      aoMock,
      queueMock,
      httpMock
    )
  })

  it('should be defined', () => {
    expect(txOracleService).toBeDefined()
  })

  describe('get block', () => {
    it('success', async () => {
      const block = await txOracleService.getBlock(1234)
      expect(typeof block).toBe('object')
    })

    it('fail', async () => {
      const block = await txOracleService.getBlock(999999999999999)
      expect(block).toBeNull()
    })
  })

  describe('get transaction', () => {
    it('success', async () => {
      const txid = 'iaiAqmcYrviugZq9biUZKJIAi_zIT_mgFHAWZzMvDuk'
      const tx = await txOracleService.getTransaction(txid)
      expect(typeof tx).toBe('object')
    })

    it('fail', async () => {
      const txid = 'bogus-tx-id'
      const tx = await txOracleService.getTransaction(txid)
      expect(tx).toBeNull()
    })
  })

  describe('get data', () => {
    it('success', async () => {
      const txid = 'iaiAqmcYrviugZq9biUZKJIAi_zIT_mgFHAWZzMvDuk'
      const data = await txOracleService.getData(txid)
      console.log('typeof data', typeof data)
      expect(data).toBeDefined()
    })

    it('fail', async () => {
      const txid = 'bogus-tx-idiaiAqmcYrviugZq9biUZKJIAi_zIT_mg'
      const data = await txOracleService.getData(txid)
      expect(data).toBeNull()
    }, 10_000)
  })
})
