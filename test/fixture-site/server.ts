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

const PAGE_SIZE = 10;
const DEFAULT_TOTAL = 25;

interface JobCard {
  readonly index: number;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly link: string;
}

function jobCard(index: number): JobCard {
  return {
    index,
    title: `Job ${String(index)}`,
    company: 'Acme',
    location: 'Remote',
    link: `/jobs/${String(index)}`,
  };
}

function cardHtml(card: JobCard): string {
  // Tall enough that ~10 cards exceed a default viewport height, so the bottom sentinel on
  // /infinite starts off-screen and only becomes visible after a real scroll — exercising
  // helpers.scrollToLoadMore() meaningfully instead of auto-loading everything at once.
  return `<li class="result" style="height:120px"><a href="${card.link}">${card.title}</a> at <span class="company">${card.company}</span>, <span class="location">${card.location}</span></li>`;
}

function searchPage(query: URLSearchParams): string {
  const total = Number(query.get('total') ?? DEFAULT_TOTAL);
  const page = Number(query.get('page') ?? 1);
  const q = query.get('q') ?? '';
  const location = query.get('location') ?? '';
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(start + PAGE_SIZE - 1, total);
  const cards: string[] = [];
  for (let i = start; i <= end; i++) cards.push(cardHtml(jobCard(i)));
  const hasNext = end < total;

  return `<!doctype html><html><body>
<form method="get" action="/search">
  <input type="hidden" name="total" value="${String(total)}">
  <label>Search jobs <input type="text" name="q" value="${q}"></label>
  <label>Location <input type="text" name="location" value="${location}"></label>
  <button type="submit">Search</button>
</form>
<ul id="results">${cards.join('')}</ul>
${hasNext ? `<form method="get" action="/search"><input type="hidden" name="q" value="${q}"><input type="hidden" name="location" value="${location}"><input type="hidden" name="total" value="${String(total)}"><input type="hidden" name="page" value="${String(page + 1)}"><button type="submit">Next</button></form>` : ''}
</body></html>`;
}

function infinitePage(query: URLSearchParams): string {
  const total = Number(query.get('total') ?? DEFAULT_TOTAL);
  const initialCount = Math.min(PAGE_SIZE, total);
  const cards: string[] = [];
  for (let i = 1; i <= initialCount; i++) cards.push(cardHtml(jobCard(i)));

  return `<!doctype html><html><body>
<ul id="results">${cards.join('')}</ul>
<div id="sentinel" style="height:1px"></div>
<script>
(function () {
  var total = ${String(total)};
  var loaded = ${String(initialCount)};
  var loading = false;
  var sentinel = document.getElementById('sentinel');

  function loadMore() {
    if (loading || loaded >= total) return;
    loading = true;
    fetch('/infinite/more?offset=' + loaded + '&total=' + total)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var ul = document.getElementById('results');
        data.html.forEach(function (li) {
          var el = document.createElement('div');
          el.innerHTML = li;
          ul.appendChild(el.firstChild);
        });
        loaded += data.count;
        loading = false;
        if (loaded >= total) {
          observer.disconnect();
          return;
        }
        // Re-observing forces a fresh intersection check: the sentinel's ratio may not
        // have crossed a threshold since appending (it stayed continuously visible), so
        // the observer would otherwise never re-fire on its own.
        observer.unobserve(sentinel);
        observer.observe(sentinel);
      });
  }

  // A real IntersectionObserver, not a 'scroll' listener: fixture pages are short, so a
  // programmatic scrollTo() may never move scrollY (nothing to scroll), and thus never
  // fires a native 'scroll' event — the observer fires whenever the sentinel is visible,
  // scroll or not, matching how real infinite-scroll pages behave when content is short.
  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) loadMore();
  });
  observer.observe(sentinel);
})();
</script>
</body></html>`;
}

function infiniteMore(query: URLSearchParams): {
  readonly count: number;
  readonly html: readonly string[];
} {
  const total = Number(query.get('total') ?? DEFAULT_TOTAL);
  const offset = Number(query.get('offset') ?? 0);
  const start = offset + 1;
  const end = Math.min(start + PAGE_SIZE - 1, total);
  const html: string[] = [];
  for (let i = start; i <= end; i++) html.push(cardHtml(jobCard(i)));
  return { count: html.length, html };
}

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

  if (url.pathname === '/search' && req.method === 'GET') {
    if (!isLoggedIn) {
      redirect(res, '/login');
      return;
    }
    send(res, 200, searchPage(url.searchParams));
    return;
  }

  if (url.pathname === '/infinite' && req.method === 'GET') {
    if (!isLoggedIn) {
      redirect(res, '/login');
      return;
    }
    send(res, 200, infinitePage(url.searchParams));
    return;
  }

  if (url.pathname === '/infinite/more' && req.method === 'GET') {
    if (!isLoggedIn) {
      res.writeHead(401).end();
      return;
    }
    const body = JSON.stringify(infiniteMore(url.searchParams));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
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
