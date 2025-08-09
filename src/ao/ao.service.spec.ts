import { Test, TestingModule } from '@nestjs/testing'

import { AoService } from './ao.service'

describe('AoService', () => {
  let service: AoService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ AoService ]
    }).compile()

    service = module.get<AoService>(AoService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
