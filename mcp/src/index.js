#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { compactPet, filterPets, getJson } from './api.js';

const server = new McpServer(
  { name: 'pawline-mcp', version: '1.0.0' },
  {
    instructions: [
      'Pawline provides current public pet-adoption listings from authorized and official sources.',
      'Treat availability and listing details as time-sensitive and confirm them with the linked shelter.',
      'Do not present search order as a compatibility judgment or adoption recommendation.',
    ].join(' '),
  },
);

server.registerTool(
  'search_adoptable_pets',
  {
    title: 'Search Adoptable Pets',
    description: 'Search current Pawline dog and cat listings. Results include source links for confirmation with the shelter.',
    inputSchema: {
      species: z.enum(['Dog', 'Cat']).optional().describe('Limit results to dogs or cats.'),
      query: z.string().trim().max(120).optional().describe('Filter returned listings by name, breed, location, shelter, or listing text.'),
      limit: z.number().int().min(1).max(25).default(10).describe('Maximum number of listings to return.'),
      page: z.number().int().min(1).max(100).default(1).describe('Provider result page to request.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ species, query, limit, page }) => {
    try {
      const payload = await getJson('/api/pets', {
        species,
        limit: Math.max(limit, query ? 25 : limit),
        page,
      });
      const pets = filterPets(payload.pets || [], query).slice(0, limit).map(compactPet);
      const result = {
        mode: payload.mode,
        partial: Boolean(payload.partial),
        provider: payload.provider,
        fetchedAt: payload.fetchedAt,
        count: pets.length,
        pets,
        notice: payload.message || 'Availability can change. Confirm current details with the linked shelter.',
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Pawline search failed: ${error.message}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'list_adoption_sources',
  {
    title: 'List Adoption Sources',
    description: 'List Pawline data sources and their current integration status.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async () => {
    try {
      const result = await getJson('/api/sources');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Source lookup failed: ${error.message}` }], isError: true };
    }
  },
);

server.registerTool(
  'check_pawline_status',
  {
    title: 'Check Pawline Status',
    description: 'Check Pawline service health and configured provider counts.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async () => {
    try {
      const result = await getJson('/api/health');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Health check failed: ${error.message}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
