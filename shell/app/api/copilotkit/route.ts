import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import OpenAI from 'openai';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'placeholder',
    baseURL: process.env.AZURE_OPENAI_ENDPOINT,
    defaultQuery: { 'api-version': '2024-02-01' },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
  });

  const serviceAdapter = new OpenAIAdapter({
    openai,
    model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'Phi-4-mini-reasoning-1',
  });

  const runtime = new CopilotRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilotkit',
  });
  return handleRequest(req);
}
