import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents as getMDXComponents } from '../../mdx-components'
import { TOCProvider } from '../contexts/TOCContext'
import BottomBar from '../components/navigation/BottomBar'
import DocsErrorBoundary from '../components/errors/DocsErrorBoundary'

type DocsPageParams = {
  slug?: string[]
}

type DocsPageProps = {
  params: Promise<DocsPageParams>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const generateStaticParams = generateStaticParamsFor('slug')

export async function generateMetadata({ params }: DocsPageProps) {
  const resolvedParams = await params
  const { metadata } = await importPage(resolvedParams.slug)
  return metadata
}

export default async function Page(props: DocsPageProps) {
  const params = await props.params
  const result = await importPage(params.slug)
  const { default: MDXContent, toc, metadata } = result

  const components = getMDXComponents()
  const Wrapper = components.wrapper

  if (Wrapper) {
    return (
      <TOCProvider initialTOC={toc}>
        <DocsErrorBoundary>
          <Wrapper toc={toc} metadata={metadata}>
            <MDXContent {...props} params={params} />
          </Wrapper>
        </DocsErrorBoundary>
        <BottomBar />
      </TOCProvider>
    )
  }

  return (
    <TOCProvider initialTOC={toc}>
      <DocsErrorBoundary>
        <MDXContent {...props} params={params} />
      </DocsErrorBoundary>
      <BottomBar />
    </TOCProvider>
  )
}
