import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpUser } from "@/lib/admin/mcp-auth";
import { createAdminMcpServer } from "@/lib/admin/mcp-server";

export function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Stateless: a fresh Server + transport per request. Every tool resolves its own state from
// GitHub, since serverless functions keep nothing between requests. Callers must authenticate
// the request first; this does no auth of its own.
export async function respondToMcp(req: Request, user: McpUser): Promise<Response> {
  // No standalone server-to-client stream (GET) and no sessions to end (DELETE). Without this, GET
  // opened a stream that never closed and ChatGPT's "Create MCP app" hung (seen in ramprate-ui).
  if (req.method === "GET" || req.method === "DELETE") {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: use POST" }, id: null }),
      { status: 405, headers: { "content-type": "application/json", allow: "POST" } },
    );
  }
  const server = createAdminMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
