import type { Metadata } from "next";
import { validateAuthorizeRequest } from "@/lib/admin/mcp-oauth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in to connect | Conscious Compute",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "That email and password don't match a Conscious Compute team member.",
  locked: "Too many attempts. Wait 15 minutes, then try again.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function flat(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

const input =
  "w-full border-2 border-ink bg-white px-3 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-violet";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-[1.4rem] font-bold">Conscious Compute</p>
        <div className="border-2 border-ink bg-white px-5 py-6 sm:px-8 sm:py-8">{children}</div>
        <p className="mt-6 text-center text-[0.8rem] text-mute">Team members only.</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const q = flat(await searchParams);
  const checked = q.invalid ? { error: q.invalid } : await validateAuthorizeRequest(q);

  if ("error" in checked) {
    return (
      <Shell>
        <h1 className="mt-0 mb-3 text-[1.3rem]">Can&apos;t sign in from this link</h1>
        <p className="text-[0.9rem]">{checked.error}</p>
        <p className="mb-0 text-[0.9rem] text-mute">Go back to ChatGPT or Claude and connect again from there.</p>
      </Shell>
    );
  }

  const error = q.error ? ERRORS[q.error] : undefined;
  const hidden = {
    response_type: "code",
    client_id: checked.params.clientId,
    redirect_uri: checked.params.redirectUri,
    state: checked.params.state,
    code_challenge: checked.params.codeChallenge,
    code_challenge_method: "S256",
    scope: checked.params.scope,
    resource: checked.params.resource,
  };

  return (
    <Shell>
      <p className="mb-1 text-[0.75rem] font-semibold tracking-[0.12em] text-violet uppercase">Sign in</p>
      <h1 className="mt-0 mb-2 text-[1.3rem] sm:text-[1.5rem]">Connect {checked.appName} to Conscious Compute</h1>
      <p className="text-[0.9rem] text-mute">
        Sign in with your team email to let {checked.appName} prepare changes to the website for you. Nothing goes live
        without your review.
      </p>

      {error ? (
        <p role="alert" className="border-l-4 border-rust bg-wash px-3 py-2 text-[0.9rem]">
          {error}
        </p>
      ) : null}

      <form method="post" action="/api/oauth/authorize" className="space-y-4">
        {Object.entries(hidden).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[0.9rem] font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue={q.email ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-[0.9rem] font-medium">
            Password
          </label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={input} />
        </div>
        <button
          type="submit"
          className="w-full bg-violet py-3 text-[0.9rem] font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Sign in and connect
        </button>
      </form>
    </Shell>
  );
}
