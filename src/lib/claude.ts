import Anthropic from '@anthropic-ai/sdk'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY']! })

export async function synthesizeStructured<T>(params: {
  systemPrompt: string
  userContent: string
  outputSchema: z.ZodType<T>
  toolName: string
  toolDescription: string
}): Promise<T> {
  const { systemPrompt, userContent, outputSchema, toolName, toolDescription } =
    params

  const jsonSchema = zodToJsonSchema(outputSchema, { target: 'openApi3' })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: jsonSchema as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool', name: toolName },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUseBlock = response.content.find(
    (block) => block.type === 'tool_use'
  )
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a tool use block')
  }

  const parsed = outputSchema.safeParse(toolUseBlock.input)
  if (!parsed.success) {
    throw new Error(
      `Schema validation failed: ${JSON.stringify(parsed.error.errors)}`
    )
  }

  return parsed.data
}
