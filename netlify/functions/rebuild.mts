/**
 * POST /.netlify/functions/rebuild — start een nieuwe Netlify-build (spec §8).
 *
 * Alleen voor de ingelogde admin: het Supabase-token uit de Authorization-header wordt bij Supabase
 * gecontroleerd, en de gebruiker moet app_metadata.role = 'admin' hebben. De build hook-URL blijft
 * zo geheim (staat alleen in de Netlify-omgevingsvariabele NETLIFY_BUILD_HOOK_URL).
 */
import type { Config } from '@netlify/functions';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const env = (k: string) => (globalThis as any).Netlify?.env.get(k) ?? process.env[k];
  const supabaseUrl = env('PUBLIC_SUPABASE_URL');
  const anonKey = env('PUBLIC_SUPABASE_ANON_KEY');
  const hook = env('NETLIFY_BUILD_HOOK_URL');
  if (!supabaseUrl || !anonKey || !hook) {
    return new Response('Server mist PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY of NETLIFY_BUILD_HOOK_URL', { status: 500 });
  }

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return new Response('Niet ingelogd', { status: 401 });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: auth },
  });
  if (!userRes.ok) return new Response('Sessie ongeldig of verlopen; log opnieuw in', { status: 401 });
  const user = await userRes.json();
  if (user?.app_metadata?.role !== 'admin') return new Response('Geen beheerrechten', { status: 403 });

  const hookRes = await fetch(hook, { method: 'POST' });
  if (!hookRes.ok) return new Response(`Build hook gaf ${hookRes.status}`, { status: 502 });

  return new Response('Build gestart', { status: 202 });
};

export const config: Config = { path: '/.netlify/functions/rebuild' };
