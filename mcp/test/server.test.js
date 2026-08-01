import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('stdio server advertises the Pawline read-only tools', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.js', import.meta.url))],
  });
  const client = new Client({ name: 'pawline-mcp-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((tool) => tool.name).sort(),
      ['check_pawline_status', 'list_adoption_sources', 'search_adoptable_pets'],
    );
    assert.equal(
      result.tools.every((tool) => tool.annotations?.readOnlyHint === true),
      true,
    );
  } finally {
    await client.close();
  }
});
