#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MealieApi, MealieApiError } from './api.js';
import { type Config, isToolEnabled, loadConfig } from './config.js';
import { allTools } from './tools.js';

async function main() {
  // Load configuration
  let config: Config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Failed to load configuration',
    );
    process.exit(1);
  }

  // Initialize API client
  const api = new MealieApi(config);

  // Create MCP server
  const server = new McpServer({
    name: 'mealie-mcp',
    version: '1.0.0',
  });

  // Register tools
  const enabledTools = allTools.filter((tool) =>
    isToolEnabled(config, tool.name),
  );

  for (const tool of enabledTools) {
    // Convert Zod schema to JSON Schema for MCP
    const jsonSchema = zodToJsonSchema(tool.inputSchema);

    server.tool(tool.name, tool.description, jsonSchema, async (args) => {
      try {
        const result = await tool.handler(api, args);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof MealieApiError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: error.message,
                    statusCode: error.statusCode,
                    details: error.response,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
        if (error instanceof z.ZodError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: 'Invalid input',
                    details: error.errors,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Convert Zod schema to JSON Schema (simplified conversion)
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!isOptional(value)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: Record<string, unknown> = { type: 'number' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    const result: Record<string, unknown> = { type: 'boolean' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodArray) {
    const elementSchema = schema._def.type as z.ZodType;
    return {
      type: 'array',
      items: zodToJsonSchema(elementSchema),
      ...(schema.description ? { description: schema.description } : {}),
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType as z.ZodType);
  }

  if (schema instanceof z.ZodDefault) {
    const innerSchema = zodToJsonSchema(schema._def.innerType as z.ZodType);
    return {
      ...innerSchema,
      default: schema._def.defaultValue(),
    };
  }

  if (schema instanceof z.ZodNullable) {
    return zodToJsonSchema(schema._def.innerType as z.ZodType);
  }

  // Fallback for complex types
  return { type: 'object' };
}

function isOptional(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodOptional) return true;
  if (schema instanceof z.ZodDefault) return true;
  if (schema instanceof z.ZodNullable) return true;
  return false;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
