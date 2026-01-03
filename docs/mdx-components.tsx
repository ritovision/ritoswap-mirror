import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'

type DocsComponents = ReturnType<typeof getDocsMDXComponents>

export function useMDXComponents(components?: DocsComponents): DocsComponents {
  const docsComponents = getDocsMDXComponents()
  return {
    ...docsComponents,
    ...components
  }
}
