// dapp/scripts/codegen/generate-tool-types.ts
// Run with: pnpm codegen:tools
// Purpose: generate app/lib/mcp/generated/tool-catalog-types.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type JsonSchema = any;
type ToolInfo = {
  name: string;
  schema: JsonSchema;
};

/**
 * Extract tool info by parsing TypeScript files without importing them.
 * This avoids runtime errors from server-only imports.
 */
function extractToolInfo(filePath: string): ToolInfo | null {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  let toolName: string | null = null;
  let inputSchema: JsonSchema | null = null;

  // Find the InputSchema const and tool object
  function visit(node: ts.Node) {
    // Look for: const InputSchema: Record<string, unknown> = { ... }
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length > 0
    ) {
      const decl = node.declarationList.declarations[0];
      if (
        ts.isVariableDeclaration(decl) &&
        decl.name.getText() === 'InputSchema' &&
        decl.initializer
      ) {
        try {
          // Extract the object literal text and parse it
          const schemaText = decl.initializer.getText();
          // Use Function constructor to safely evaluate the object literal
          inputSchema = new Function(`return ${schemaText}`)();
        } catch (e) {
          console.warn(`Failed to parse InputSchema in ${filePath}:`, e);
        }
      }
    }

    // Look for: const tool: Tool<...> = { name: '...', ... }
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length > 0
    ) {
      const decl = node.declarationList.declarations[0];
      if (
        ts.isVariableDeclaration(decl) &&
        decl.name.getText() === 'tool' &&
        decl.initializer &&
        ts.isObjectLiteralExpression(decl.initializer)
      ) {
        // Find the name property
        for (const prop of decl.initializer.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            prop.name?.getText() === 'name'
          ) {
            const nameValue = prop.initializer.getText();
            // Remove quotes
            toolName = nameValue.replace(/^['"`]|['"`]$/g, '');
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (toolName && inputSchema) {
    return { name: toolName, schema: inputSchema };
  }

  return null;
}

/**
 * Scan the tools directory and extract all tool definitions
 */
function scanTools(): ToolInfo[] {
  const toolsDir = path.resolve(__dirname, '../../app/lib/mcp/tools');
  const files = fs.readdirSync(toolsDir);
  const tools: ToolInfo[] = [];

  for (const file of files) {
    if (!file.endsWith('.ts') || file === 'index.ts' || file === 'types.ts') {
      continue;
    }

    const filePath = path.join(toolsDir, file);
    const toolInfo = extractToolInfo(filePath);
    
    if (toolInfo) {
      console.log(`✓ Extracted: ${toolInfo.name} from ${file}`);
      tools.push(toolInfo);
    } else {
      console.warn(`⚠ Could not extract tool info from ${file}`);
    }
  }

  return tools;
}

function toTsFromSchema(schema: JsonSchema): string {
  const gen = (s: JsonSchema): string => {
    if (!s) return 'unknown';
    
    if (Array.isArray(s.enum) && s.enum.length) {
      return s.enum.map((v: unknown) => JSON.stringify(v)).join(' | ');
    }
    
    const t = s.type;
    if (Array.isArray(t) && t.length) {
      return Array.from(new Set(t)).map((tt: string) => gen({ ...s, type: tt })).join(' | ');
    }
    
    switch (t) {
      case 'string': return 'string';
      case 'number':
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'null': return 'null';
      case 'array': {
        const it = s.items ? gen(s.items) : 'unknown';
        return `${it}[]`;
      }
      case 'object': {
        const props = s.properties || {};
        const req: string[] = Array.isArray(s.required) ? s.required : [];
        const entries = Object.entries(props).map(([k, v]: [string, any]) => {
          const opt = req.includes(k) ? '' : '?';
          return `  ${JSON.stringify(k)}${opt}: ${gen(v)};`;
        });
        if (entries.length === 0) return 'Record<string, unknown>';
        return `{\n${entries.join('\n')}\n}`;
      }
      default:
        return 'unknown';
    }
  };
  
  return gen(schema);
}

function generate() {
  console.log('🔧 Scanning tools directory for type extraction...');
  const tools = scanTools();
  
  if (tools.length === 0) {
    console.error('❌ No tools found!');
    process.exit(1);
  }
  
  const toolNames = tools.map((t) => t.name);
  
  const inputMapEntries = tools.map((t) => {
    const ts = toTsFromSchema(t.schema);
    return `  ${JSON.stringify(t.name)}: ${ts};`;
  });
  
  const out = `// AUTO-GENERATED. DO NOT EDIT.
// Generated by dapp/scripts/codegen/generate-tool-types.ts

export const KNOWN_TOOLS = ${JSON.stringify(toolNames, null, 2)} as const;

export type ToolName = typeof KNOWN_TOOLS[number];

export type ToolInputMap = {
${inputMapEntries.join('\n')}
};

export type ToolOutputMap = {
  // reserve for future per-tool output typings
  [K in ToolName]: unknown;
};
`;

  const dest = path.resolve(__dirname, '../../app/lib/mcp/generated/tool-catalog-types.ts');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out, 'utf8');
  
  console.log(`✅ Generated types for ${tools.length} tools`);
  console.log(`📝 Wrote ${dest}`);
}

generate();