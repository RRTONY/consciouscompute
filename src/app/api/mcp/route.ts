import { bearerFromRequest, isMcpAuthConfigured } from "@/lib/admin/mcp-auth";
import { jsonError, respondToMcp } from "@/lib/admin/mcp-handler";
import { authenticateMcpBearer, publicOrigin, wwwAuthenticateHeader } from "@/lib/admin/mcp-oauth";

export const dynamic = "force-dynamic";
// check_pr_status waits up to ~20s for running checks.
export const maxDuration = 60;

// The 401's WWW-Authenticate header is how ChatGPT and Claude discover the sign-in page.
async function handle(req: Request): Promise<Response> {
  if (!isMcpAuthConfigured()) {
    return jsonError(500, "MCP_ADMIN_USERS is not configured");
  }
  const user = authenticateMcpBearer(bearerFromRequest(req));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": wwwAuthenticateHeader(publicOrigin(req)),
      },
    });
  }
  return respondToMcp(req, user);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
