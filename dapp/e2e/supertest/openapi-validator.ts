// FILE: c:\Users\Mattj\techstuff\ritoswap-clean\ritoswap1\dapp\e2e\supertest\openapi-validator.ts

import type { Response as SupertestResponse } from 'supertest';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Simple OpenAPI Validator for Supertest
 * Uses AJV for JSON Schema validation instead of the buggy openapi-validator libraries
 */
export class OpenAPITestValidator {
  private spec: any; // OpenAPI spec as plain object
  private ajv: Ajv;
  private validationErrors: Array<{
    endpoint: string;
    method: string;
    errors: any;
    timestamp: Date;
  }> = [];

  constructor(specPath?: string) {
    // Load OpenAPI spec from public directory or provided path
    const openApiPath = specPath || path.join(process.cwd(), 'public', 'openapi.json');
    
    if (!fs.existsSync(openApiPath)) {
      throw new Error(`OpenAPI spec not found at: ${openApiPath}`);
    }

    this.spec = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    
    // Initialize AJV with formats
    this.ajv = new Ajv({ 
      strict: false, 
      allErrors: true,
      validateFormats: true 
    });
    addFormats(this.ajv);
    
    // Add all component schemas to AJV if they exist
    if (this.spec.components?.schemas) {
      for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
        // Add schema with its reference ID
        this.ajv.addSchema(schema as any, `#/components/schemas/${name}`);
      }
    }
  }

  /**
   * Validate a supertest response against the OpenAPI spec
   * @param response - Supertest response object
   * @param path - API path (e.g., '/api/token-status/{tokenId}')
   * @param method - HTTP method
   * @param pathParams - Path parameters for substitution
   * @returns Validation result with errors if any
   */
  validateResponse(
    response: SupertestResponse,
    path: string,
    method: string,
    pathParams?: Record<string, string>
  ): { valid: boolean; errors?: any[] } {
    // Normalize path by replacing path parameters
    let normalizedPath = path;
    if (pathParams) {
      for (const [param, value] of Object.entries(pathParams)) {
        normalizedPath = normalizedPath.replace(value, `{${param}}`);
      }
    }

    // Find the path in the spec
    const pathSpec = this.spec.paths?.[normalizedPath];
    if (!pathSpec) {
      console.warn(`No spec found for path: ${normalizedPath}`);
      return { valid: true }; // Skip validation if no spec found
    }

    // Find the method in the path spec
    const methodSpec = pathSpec[method.toLowerCase()];
    if (!methodSpec) {
      console.warn(`No spec found for method: ${method} on path: ${normalizedPath}`);
      return { valid: true };
    }

    // Find the response spec for the status code
    const responseSpec = methodSpec.responses?.[response.status] || methodSpec.responses?.default;
    if (!responseSpec) {
      console.warn(`No response spec found for status ${response.status} on ${method} ${normalizedPath}`);
      return { valid: true };
    }

    // Get the schema from the response spec
    let schema = responseSpec.content?.['application/json']?.schema;
    if (!schema) {
      // No schema defined for this response
      return { valid: true };
    }

    // Resolve $ref if present
    if (schema.$ref) {
      schema = this.resolveRef(schema.$ref);
    }

    // Validate the response body against the schema
    const validate = this.ajv.compile(schema);
    const valid = validate(response.body);

    if (!valid) {
      this.validationErrors.push({
        endpoint: normalizedPath,
        method,
        errors: validate.errors,
        timestamp: new Date(),
      });

      return {
        valid: false,
        errors: validate.errors || [],
      };
    }

    return { valid: true };
  }

  /**
   * Resolve a $ref reference to get the actual schema
   */
  private resolveRef(ref: string): any {
    // Remove the leading '#/' if present
    const refPath = ref.replace(/^#\//, '').split('/');
    
    let current: any = this.spec;
    for (const segment of refPath) {
      current = current?.[segment];
      if (!current) {
        console.warn(`Could not resolve reference: ${ref}`);
        return {};
      }
    }
    
    return current;
  }

  /**
   * Validate request parameters against the OpenAPI spec
   */
  validateRequest(
    path: string,
    method: string,
    request: {
      headers?: Record<string, string>;
      params?: Record<string, any>;
      query?: Record<string, any>;
      body?: any;
    }
  ): { valid: boolean; errors?: any[] } {
    const pathSpec = this.spec.paths?.[path];
    if (!pathSpec) return { valid: true };

    const methodSpec = pathSpec[method.toLowerCase()];
    if (!methodSpec) return { valid: true };

    const errors: any[] = [];

    // Validate request body if present
    if (request.body && methodSpec.requestBody) {
      const bodySchema = methodSpec.requestBody.content?.['application/json']?.schema;
      if (bodySchema) {
        const schema = bodySchema.$ref ? this.resolveRef(bodySchema.$ref) : bodySchema;
        const validate = this.ajv.compile(schema);
        if (!validate(request.body)) {
          errors.push(...(validate.errors || []));
        }
      }
    }

    // Validate query parameters
    if (request.query && methodSpec.parameters) {
      for (const param of methodSpec.parameters) {
        if (param.in === 'query' && param.schema) {
          const validate = this.ajv.compile(param.schema);
          const value = request.query[param.name];
          if (param.required && value === undefined) {
            errors.push({
              message: `Required query parameter '${param.name}' is missing`,
            });
          } else if (value !== undefined && !validate(value)) {
            errors.push(...(validate.errors || []));
          }
        }
      }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  }

  /**
   * Get all validation errors collected during tests
   */
  getValidationErrors(): typeof this.validationErrors {
    return this.validationErrors;
  }

  /**
   * Clear validation errors
   */
  clearErrors(): void {
    this.validationErrors = [];
  }

  /**
   * Generate a validation report
   */
  generateReport(): string {
    if (this.validationErrors.length === 0) {
      return '✅ All API responses match OpenAPI specification';
    }

    let report = `❌ Found ${this.validationErrors.length} OpenAPI validation errors:\n\n`;
    
    for (const error of this.validationErrors) {
      report += `📍 ${error.method.toUpperCase()} ${error.endpoint}\n`;
      report += `   Time: ${error.timestamp.toISOString()}\n`;
      report += `   Errors:\n`;
      
      if (Array.isArray(error.errors)) {
        for (const err of error.errors) {
          report += `   - ${err.message || err.keyword}: ${err.schemaPath || err.instancePath}\n`;
          if (err.params) {
            report += `     Params: ${JSON.stringify(err.params)}\n`;
          }
        }
      } else {
        report += `   - ${JSON.stringify(error.errors)}\n`;
      }
      report += '\n';
    }

    return report;
  }

  /**
   * Get coverage statistics
   */
  getCoverageStats(): {
    total: number;
    tested: Set<string>;
    untested: Set<string>;
    coverage: number;
  } {
    const allEndpoints = new Set<string>();
    const testedEndpoints = new Set<string>();

    if (this.spec.paths) {
      for (const [path, pathItem] of Object.entries(this.spec.paths)) {
        if (typeof pathItem === 'object' && pathItem !== null) {
          for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
            if ((pathItem as any)[method]) {
              allEndpoints.add(`${method.toUpperCase()} ${path}`);
            }
          }
        }
      }
    }

    // Track tested endpoints from validation errors and successful validations
    // This is a simplified version - you might want to track this more carefully
    for (const error of this.validationErrors) {
      testedEndpoints.add(`${error.method.toUpperCase()} ${error.endpoint}`);
    }
    
    const untested = new Set(
      [...allEndpoints].filter(x => !testedEndpoints.has(x))
    );

    return {
      total: allEndpoints.size,
      tested: testedEndpoints,
      untested,
      coverage: allEndpoints.size > 0 ? (testedEndpoints.size / allEndpoints.size * 100) : 0,
    };
  }
}

/**
 * Helper function to create a validator instance with caching
 */
let cachedValidator: OpenAPITestValidator | null = null;

export function getOpenAPIValidator(specPath?: string): OpenAPITestValidator {
  if (!cachedValidator) {
    cachedValidator = new OpenAPITestValidator(specPath);
  }
  return cachedValidator;
}

/**
 * Vitest custom matcher for OpenAPI validation (optional)
 */
export const openAPIMatchers = {
  toMatchOpenAPISpec(
    response: SupertestResponse,
    path: string,
    method: string,
    pathParams?: Record<string, string>
  ) {
    const validator = getOpenAPIValidator();
    const result = validator.validateResponse(response, path, method, pathParams);

    return {
      pass: result.valid,
      message: () => {
        if (result.valid) {
          return `Response matches OpenAPI spec for ${method.toUpperCase()} ${path}`;
        }
        return `Response does not match OpenAPI spec for ${method.toUpperCase()} ${path}:\n${JSON.stringify(result.errors, null, 2)}`;
      },
    };
  },
};