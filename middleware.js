export const config = {
  matcher: ['/((?!api).*)'],
};

export default function middleware(req) {
  const auth = req.headers.get('authorization');
  const user = process.env.BASIC_AUTH_USER || 'angloville';
  const pass = process.env.BASIC_AUTH_PASS || 'mailing2025';
  const expected = 'Basic ' + btoa(user + ':' + pass);

  if (auth === expected) return;

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Angloville"' },
  });
}
