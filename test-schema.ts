import { z } from 'zod';

// Copy the zodToJsonSchema function from index.ts
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
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

  // Fallback
  console.log('FALLBACK - unhandled type:', typeName, schema.constructor.name);
  return { type: 'object' };
}

function isOptional(schema: z.ZodType): boolean {
  const typeName = schema._zod?.def?.type ?? schema.constructor.name;
  if (typeName === 'optional' || schema instanceof z.ZodOptional) return true;
  if (typeName === 'default' || schema instanceof z.ZodDefault) return true;
  if (typeName === 'nullable' || schema instanceof z.ZodNullable) return true;
  return false;
}

// Test
const getRecipeSchema = z.object({
  slug: z.string().describe('Recipe slug (unique identifier)'),
});

const result = zodToJsonSchema(getRecipeSchema);
console.log('Result:', JSON.stringify(result, null, 2));
