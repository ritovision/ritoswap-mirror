import { readdir, writeFile } from 'fs/promises';
import { join, sep } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITE_URL = 'https://docs.ritoswap.com';
const CONTENT_DIR = join(__dirname, '../content');
const PUBLIC_DIR = join(__dirname, '../public');
const OUTPUT_FILE = join(PUBLIC_DIR, 'sitemap.xml');

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dir, fileList = []) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dir, file.name);

    if (file.isDirectory()) {
      await getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Convert file path to URL path
 */
function filePathToUrl(filePath, baseDir) {
  // Get relative path from base directory
  let relativePath = filePath.replace(baseDir, '').replace(/\\/g, '/');

  // Remove leading slash
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }

  // Remove .mdx extension
  relativePath = relativePath.replace(/\.mdx$/, '');

  // Convert index to root path
  if (relativePath.endsWith('/index') || relativePath === 'index') {
    relativePath = relativePath.replace(/\/index$/, '').replace(/^index$/, '');
  }

  // Ensure leading slash
  if (relativePath && !relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  return relativePath || '/';
}

/**
 * Get priority based on path depth and name
 */
function getPriority(urlPath) {
  if (urlPath === '/') return '1.0';

  const depth = urlPath.split('/').filter(Boolean).length;

  if (depth === 1) return '0.8';
  if (depth === 2) return '0.6';
  return '0.5';
}

/**
 * Generate sitemap XML
 */
async function generateSitemap() {
  console.log('🗺️  Generating sitemap...');

  try {
    // Get all MDX files
    const contentFiles = await getAllFiles(CONTENT_DIR);
    const mdxFiles = contentFiles.filter(file => file.endsWith('.mdx'));

    console.log(`📄 Found ${mdxFiles.length} MDX files`);

    // Get all image files
    const publicFiles = await getAllFiles(PUBLIC_DIR);
    const imageFiles = publicFiles.filter(file =>
      /\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/i.test(file)
    );

    console.log(`🖼️  Found ${imageFiles.length} image files`);

    // Generate URLs for MDX files
    const pageUrls = mdxFiles.map(file => {
      const urlPath = filePathToUrl(file, CONTENT_DIR);
      const priority = getPriority(urlPath);

      return {
        loc: `${SITE_URL}${urlPath}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority,
      };
    });

    // Generate URLs for images
    const imageUrls = imageFiles.map(file => {
      let relativePath = file.replace(PUBLIC_DIR, '').replace(/\\/g, '/');

      // Ensure leading slash
      if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }

      return {
        loc: `${SITE_URL}${relativePath}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: '0.3',
      };
    });

    // Combine all URLs
    const allUrls = [...pageUrls, ...imageUrls];

    // Sort URLs by priority (descending) then alphabetically
    allUrls.sort((a, b) => {
      if (a.priority !== b.priority) {
        return parseFloat(b.priority) - parseFloat(a.priority);
      }
      return a.loc.localeCompare(b.loc);
    });

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    // Write sitemap file
    await writeFile(OUTPUT_FILE, xml, 'utf-8');

    console.log(`✅ Sitemap generated successfully!`);
    console.log(`📍 Location: ${OUTPUT_FILE}`);
    console.log(`📊 Total URLs: ${allUrls.length} (${pageUrls.length} pages + ${imageUrls.length} images)`);

  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run the generator
generateSitemap();
