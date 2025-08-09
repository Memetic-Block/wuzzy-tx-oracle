import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getInfo(): string {
    return 'Wuzzy Transaction Oracle Service ' +
      'built & operated by Memetic Block: https://memeticblock.com'
  }
}
