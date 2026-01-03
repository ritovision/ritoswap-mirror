// scripts/generate-versions.ts
// Place this in your monorepo root

const fs = require('fs');
const path = require('path');

// Your actual workspace structure
const workspaces = {
  root: '.',
  'local-blockchain': './local-blockchain',
  docs: './docs',
  dapp: './dapp',
  'colored-keys': './colored-keys',
  cloudflare: './dapp/cloudflare'
};

function getVersions() {
  const versions: Record<string, string> = {};
  
  for (const [name, relativePath] of Object.entries(workspaces)) {
    try {
      const packageJsonPath = path.join(process.cwd(), relativePath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      versions[name] = packageJson.version;
      console.log(`✓ Found ${name}: v${packageJson.version}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`✗ Could not read version for ${name}:`, message);
      versions[name] = 'unknown';
    }
  }
  
  return versions;
}

// Generate the versions module
const versions = getVersions();

const content = `// Auto-generated file - DO NOT EDIT
// Generated on ${new Date().toISOString()}

export const versions = ${JSON.stringify(versions, null, 2)} as const;

export type WorkspaceName = keyof typeof versions;

export default versions;
`;

// Output to multiple workspace locations
const outputPaths = [
  path.join(process.cwd(), 'lib/versions.ts'),
  path.join(process.cwd(), 'docs/lib/versions.ts'),
  path.join(process.cwd(), 'dapp/app/lib/versions/versions.ts'),
  path.join(process.cwd(), 'colored-keys/lib/versions.ts'),
  path.join(process.cwd(), 'local-blockchain/lib/versions.ts')
];

outputPaths.forEach(outputPath => {
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, content);
  console.log('✅ Generated:', outputPath);
});

console.log('\nVersions:', versions);
