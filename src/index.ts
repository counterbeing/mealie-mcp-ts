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
                    details: error.issues,
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

// Convert Zod schema to JSON Schema (simplified conversion for Zod v4)
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Use Zod v4's toJSONSchema if available, otherwise manual conversion
  const typeName = schema._zod?.def?.type ?? schema.constructor.name;

  if (typeName === 'object' || schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType);
      if (!isOptional(value as z.ZodType)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (typeName === 'string' || schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (typeName === 'number' || schema instanceof z.ZodNumber) {
    const result: Record<string, unknown> = { type: 'number' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (typeName === 'boolean' || schema instanceof z.ZodBoolean) {
    const result: Record<string, unknown> = { type: 'boolean' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (typeName === 'array' || schema instanceof z.ZodArray) {
    const def =
      (schema as z.ZodArray<z.ZodType>)._zod?.def ??
      (schema as z.ZodArray<z.ZodType>)._def;
    const elementSchema = def?.element ?? def?.type;
    return {
      type: 'array',
      items: elementSchema
        ? zodToJsonSchema(elementSchema)
        : { type: 'object' },
      ...(schema.description ? { description: schema.description } : {}),
    };
  }

  if (typeName === 'optional' || schema instanceof z.ZodOptional) {
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Zod structure
    const def = (schema as any)._zod?.def ?? (schema as any)._def;
    const innerType = def?.innerType;
    return innerType ? zodToJsonSchema(innerType) : { type: 'object' };
  }

  if (typeName === 'default' || schema instanceof z.ZodDefault) {
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Zod structure
    const def = (schema as any)._zod?.def ?? (schema as any)._def;
    const innerType = def?.innerType;
    const innerSchema = innerType
      ? zodToJsonSchema(innerType)
      : { type: 'object' };
    const defaultVal =
      typeof def?.defaultValue === 'function'
        ? def.defaultValue()
        : def?.defaultValue;
    return {
      ...innerSchema,
      ...(defaultVal !== undefined ? { default: defaultVal } : {}),
    };
  }

  if (typeName === 'nullable' || schema instanceof z.ZodNullable) {
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Zod structure
    const def = (schema as any)._zod?.def ?? (schema as any)._def;
    const innerType = def?.innerType;
    return innerType ? zodToJsonSchema(innerType) : { type: 'object' };
  }

  // Fallback for complex types
  return { type: 'object' };
}

function isOptional(schema: z.ZodType): boolean {
  const typeName = schema._zod?.def?.type ?? schema.constructor.name;
  if (typeName === 'optional' || schema instanceof z.ZodOptional) return true;
  if (typeName === 'default' || schema instanceof z.ZodDefault) return true;
  if (typeName === 'nullable' || schema instanceof z.ZodNullable) return true;
  return false;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
