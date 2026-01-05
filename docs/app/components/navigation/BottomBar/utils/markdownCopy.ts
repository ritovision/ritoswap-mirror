/**
 * Converts HTML content to basic markdown format
 * @param html - The HTML string to convert
 * @returns Markdown-formatted string
 */
function htmlToMarkdown(html: string): string {
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove script and style elements
  temp.querySelectorAll('script, style, nav, header, footer').forEach((el) => el.remove());

  // Get text content with basic markdown conversion
  let markdown = '';

  const processNode = (node: Node, indent: string = ''): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        markdown += text + ' ';
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
          markdown += '\n\n# ' + element.textContent?.trim() + '\n\n';
          return;
        case 'h2':
          markdown += '\n\n## ' + element.textContent?.trim() + '\n\n';
          return;
        case 'h3':
          markdown += '\n\n### ' + element.textContent?.trim() + '\n\n';
          return;
        case 'h4':
          markdown += '\n\n#### ' + element.textContent?.trim() + '\n\n';
          return;
        case 'h5':
          markdown += '\n\n##### ' + element.textContent?.trim() + '\n\n';
          return;
        case 'h6':
          markdown += '\n\n###### ' + element.textContent?.trim() + '\n\n';
          return;
        case 'p':
          markdown += '\n\n';
          break;
        case 'br':
          markdown += '\n';
          return;
        case 'strong':
        case 'b':
          markdown += '**' + element.textContent?.trim() + '**';
          return;
        case 'em':
        case 'i':
          markdown += '*' + element.textContent?.trim() + '*';
          return;
        case 'code':
          if (element.parentElement?.tagName.toLowerCase() === 'pre') {
            markdown += '\n\n```\n' + element.textContent + '\n```\n\n';
            return;
          } else {
            markdown += '`' + element.textContent + '`';
            return;
          }
        case 'a': {
          const href = element.getAttribute('href');
          markdown += '[' + element.textContent?.trim() + '](' + href + ')';
          return;
        }
        case 'ul':
        case 'ol':
          markdown += '\n';
          break;
        case 'li':
          markdown += '\n- ';
          break;
      }

      // Process child nodes
      element.childNodes.forEach((child) => processNode(child, indent));

      if (tagName === 'p' || tagName === 'div') {
        markdown += '\n';
      }
    }
  };

  processNode(temp);

  // Clean up excessive whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();

  return markdown;
}

/**
 * Copies the current page content as markdown to the clipboard
 * @returns Promise that resolves when content is copied
 */
export async function copyPageAsMarkdown(): Promise<void> {
  try {
    // Get the main content area (adjust selector based on your page structure)
    const mainContent =
      document.querySelector('main') ||
      document.querySelector('article') ||
      document.querySelector('[role="main"]') ||
      document.body;

    if (!mainContent) {
      throw new Error('Could not find main content area');
    }

    // Get the page title
    const title = document.title;
    const url = window.location.href;

    // Convert HTML to markdown
    const contentMarkdown = htmlToMarkdown(mainContent.innerHTML);

    // Combine title, URL, and content
    const fullMarkdown = `# ${title}\n\nSource: ${url}\n\n---\n\n${contentMarkdown}`;

    // Copy to clipboard
    await navigator.clipboard.writeText(fullMarkdown);

    console.log('Page content copied as markdown');
  } catch (error) {
    console.error('Failed to copy page as markdown:', error);
    throw error;
  }
}
