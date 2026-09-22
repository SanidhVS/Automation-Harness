import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const SESSION_COOKIE = 'rerun_session';

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (header === undefined) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    cookies[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return cookies;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const loginPage = `<!doctype html><html><body>
<h1>Log in</h1>
<form method="post" action="/login">
  <label>Username <input name="username" type="text"></label>
  <label>Password <input name="password" type="password"></label>
  <button type="submit">Log in</button>
</form>
</body></html>`;

const feedPage = `<!doctype html><html><body>
<p>Welcome back</p>
<button>Account menu</button>
</body></html>`;

function send(
  res: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function redirect(
  res: ServerResponse,
  location: string,
  headers: Record<string, string> = {},
): void {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const cookies = parseCookies(req.headers.cookie);
  const isLoggedIn = cookies[SESSION_COOKIE] === '1';

  if (url.pathname === '/login' && req.method === 'GET') {
    send(res, 200, loginPage);
    return;
  }

  if (url.pathname === '/login' && req.method === 'POST') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    const username = params.get('username') ?? '';
    const password = params.get('password') ?? '';
    if (username.length > 0 && password.length > 0) {
      // Max-Age makes this a persistent cookie, not a session cookie — real sites do the
      // same for "stay logged in," and Chrome discards session cookies on clean shutdown,
      // which would make profile persistence untestable.
      redirect(res, '/feed', { 'Set-Cookie': `${SESSION_COOKIE}=1; Path=/; Max-Age=86400` });
      return;
    }
    send(res, 400, 'username and password are required');
    return;
  }

  if (url.pathname === '/feed' && req.method === 'GET') {
    if (!isLoggedIn) {
      redirect(res, '/login');
      return;
    }
    send(res, 200, feedPage);
    return;
  }

  send(res, 404, 'not found');
}

export interface FixtureSite {
  readonly url: string;
  close(): Promise<void>;
}

/** Starts the tiny fixture HTTP server used by integration tests, on a random free port.
 * No real public website is ever touched by tests (Section 14.1). */
export async function startFixtureSite(): Promise<FixtureSite> {
  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      res.writeHead(500).end(String(error));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
