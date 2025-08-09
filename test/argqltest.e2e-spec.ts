import { arGql } from 'ar-gql'

describe('ar-gql test', () => {
  it('success', async () => {
    const txid = 'iaiAqmcYrviugZq9biUZKJIAi_zIT_mgFHAWZzMvDuk'
    const tx = await arGql().tx(txid)
    expect(tx.id).toEqual(txid)
  })

  it('tx not found', async () => {
    const notx = await arGql().tx('bogus-tx-id')
    expect(notx).toBeNull()
  })

  it('http error', async () => {
    await expect(
      async () => await arGql({
        endpointUrl: 'http://localhost/graphql'
      }).tx('http-error-tx-id')
    ).rejects.toThrow()
  })
})
