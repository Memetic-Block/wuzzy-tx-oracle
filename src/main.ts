import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Logger } from '@nestjs/common'

const logger = new Logger('main.ts')

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
  .then(() => {
    logger.log(
      `Wuzzy Transaction Oracle is running on port ${process.env.PORT ?? 3000}`
    )
  })
  .catch((error) => {
    logger.error('Error starting Wuzzy Transaction Oracle:', error)
    process.exit(1)
  })
