export type Tag = {
  name: string
  value: string
}

export type BlockEdge = {
  cursor: string
  node: {
    id: string
    height: number
    previous?: string
    timestamp: number
  }
}

export type Owner = {
  address: string
  key?: string
}

export type TransactionNode = {
  id: string
  anchor?: string
  ingested_at: number
  signature?: string
  recipient: string
  owner: Owner
  fee?: {
    winston: string
    ar: string
  }
  quantity?: {
    winston: string
    ar: string
  }
  data?: {
    size?: number
    type?: string
  }
  tags: Tag[]
  block: BlockEdge["node"] | null
  parent?: {
    id: string
  }
  bundledIn?: {
    id: string
  }
}

export type TransactionEdge = {
  cursor: string
  node: TransactionNode
}

export type TransactionsResponse = {
  transactions: {
    count: number | undefined
    edges: TransactionEdge[]
  }
}
