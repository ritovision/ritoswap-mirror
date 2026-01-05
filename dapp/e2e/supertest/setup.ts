// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\setup.ts
beforeAll(() => {
  const privateKey = process.env.PRIVATE_KEY || 'NOT SET'
  const maskedKey = privateKey.length > 10 ? privateKey.substring(0, 6) + '...' + privateKey.substring(privateKey.length - 4) : privateKey
  
  console.log('🧪 E2E Tests Starting')
  console.log(`📍 Target: ${process.env.TEST_BASE_URL || 'http://localhost:3000'}`)
  console.log(`🔗 Chain ID: ${process.env.CHAIN_ID || 'NOT SET'}`)
  console.log(`🎫 Token ID: ${process.env.TOKEN_ID || 'NOT SET'}`)
  console.log(`🔑 Private Key: ${maskedKey}`)
  console.log(`🔐 State Worker/SIWE: ${process.env.NEXT_PUBLIC_ENABLE_STATE_WORKER === 'true' ? 'Enabled' : 'Disabled'}`)
  console.log(`🤖 AI Chat requires JWT: ${process.env.NEXT_PUBLIC_AI_CHAT_REQUIRES_JWT === 'true' ? 'Yes' : 'No'}`)
  console.log(`🛠️ MCP Endpoint: ${process.env.MCP_ENDPOINT || '/api/mcp'}`)
})

afterAll(() => {
  console.log('✅ E2E Tests Complete')
})
