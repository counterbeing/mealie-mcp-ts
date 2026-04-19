#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodError } from 'zod';
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
    // Debug: log tool registration for troubleshooting
    if (process.env.DEBUG_SCHEMAS === 'true') {
      console.error(`[DEBUG] Registering tool: ${tool.name}`);
    }

    // Use registerTool with Zod schema directly - SDK handles conversion
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args) => {
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
        if (error instanceof ZodError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: 'Invalid input parameters',
                    hint: 'Check that all required parameters are provided with correct types',
                    receivedArgs: args,
                    validationErrors: error.issues.map((issue) => ({
                      path: issue.path.join('.'),
                      message: issue.message,
                      expected: 'code' in issue ? issue.code : undefined,
                    })),
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
      },
    );
  }

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
