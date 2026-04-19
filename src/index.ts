#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { RequestHandler } from 'express';
import { ZodError } from 'zod';
import { MealieApi, MealieApiError } from './api.js';
import { type Config, isToolEnabled, loadConfig } from './config.js';
import { allTools } from './tools.js';

function buildServer(api: MealieApi, config: Config): McpServer {
  const server = new McpServer({
    name: 'mealie-mcp',
    version: '1.0.0',
  });

  const enabledTools = allTools.filter((tool) =>
    isToolEnabled(config, tool.name),
  );

  for (const tool of enabledTools) {
    if (process.env.DEBUG_SCHEMAS === 'true') {
      console.error(`[DEBUG] Registering tool: ${tool.name}`);
    }

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

  return server;
}

async function runStdio(api: MealieApi, config: Config): Promise<void> {
  const server = buildServer(api, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttp(api: MealieApi, config: Config): Promise<void> {
  const app = createMcpExpressApp({
    host: '0.0.0.0',
    allowedHosts: config.allowedHosts,
  });

  const handleMcpRequest: RequestHandler = async (req, res) => {
    const server = buildServer(api, config);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };

  app.post('/mcp', handleMcpRequest);
  app.get('/mcp', handleMcpRequest);

  app.listen(config.port, () => {
    console.error(
      `mealie-mcp HTTP transport listening on :${config.port} (allowedHosts: ${config.allowedHosts.join(', ')})`,
    );
  });
}

async function main() {
  let config: Config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Failed to load configuration',
    );
    process.exit(1);
  }

  const api = new MealieApi(config);

  if (config.transport === 'http') {
    await runHttp(api, config);
  } else {
    await runStdio(api, config);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
