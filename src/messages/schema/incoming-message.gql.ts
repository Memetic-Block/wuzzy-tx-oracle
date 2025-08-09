export default `query (
  $entityId: String!,
  $limit: Int!,
  $sortOrder: SortOrder!,
  $cursor: String
) {
  transactions(
    sort: $sortOrder
    first: $limit
    after: $cursor
    recipients: [$entityId]
    tags: [{name: "Data-Protocol", values: ["ao"]}]
    ingested_at: {min: 1696107600}
  ) {
    ...MessageFields
    __typename
  }
}
fragment MessageFields on TransactionConnection {
  edges {
    cursor
    node {
      id
      ingested_at
      recipient
      block {
        timestamp
        height
        __typename
      }
      tags {
        name
        value
        __typename
      }
      data {
        size
        __typename
      }
      owner {
        address
        __typename
      }
      __typename
    }
    __typename
  }
  __typename
}`
