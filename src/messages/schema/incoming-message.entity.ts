import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

import { TransactionNode } from './transaction.types'

@Entity()
export class IncomingMessage {
  constructor(init?: Omit<IncomingMessage, 'id'>) {
    Object.assign(this, init)
  }

  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  transactionId: string

  @Column()
  recipient: string

  @Column()
  from: string

  @Column({ nullable: true })
  blockHeight?: number

  @Column({ nullable: true })
  blockTimestamp?: number

  @Column()
  cursor: string

  @Column({ type: 'jsonb' })
  transaction: TransactionNode

  @Column({ type: 'boolean', default: false })
  isProcessed: boolean

  @Column({ nullable: true })
  replyMessageId?: string
}
