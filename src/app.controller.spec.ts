import { Test, TestingModule } from '@nestjs/testing'

import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService]
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe('GET /', () => {
    it('should return info from root', () => {
      const serviceName = 'Wuzzy Transaction Oracle Service'
      const operator = 'Memetic Block'
      const operatorUrl = 'https://memeticblock.com'
      expect(appController.getInfo()).toContain(serviceName)
      expect(appController.getInfo()).toContain(operator)
      expect(appController.getInfo()).toContain(operatorUrl)
    })
  })
})
