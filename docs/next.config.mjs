import nextra from 'nextra'

export default nextra({ defaultShowCopyCode: true })({
  pageExtensions: ['js','jsx','ts','tsx','md','mdx'],
  outputFileTracingRoot: process.cwd(),
})
