// Vercel Edge Function — Shared Reviews API with KV persistence + Admin delete
// Requires: @vercel/kv package

import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

const REVIEWS_KEY = 'elena_moore_reviews';
const MAX_REVIEWS = 100;

// Admin secret — set this in Vercel environment variables
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'blessgod';

export default async function handler(request) {
  const origin = request.headers.get('origin') || '*';
  const url = new URL(request.url);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET — load all reviews
  if (request.method === 'GET') {
    try {
      const reviews = await kv.get(REVIEWS_KEY) || [];
      return new Response(JSON.stringify(reviews), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to load reviews' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // POST — submit new review
  if (request.method === 'POST') {
    try {
      const review = await request.json();

      // Validate
      if (!review.name || !review.service || !review.text || !review.rating) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Sanitize
      const sanitized = {
        id: crypto.randomUUID(),
        name: String(review.name).trim().substring(0, 50),
        service: String(review.service).trim().substring(0, 50),
        text: String(review.text).trim().substring(0, 500),
        rating: Math.min(5, Math.max(1, parseInt(review.rating) || 5)),
        date: String(review.date || new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        })).substring(0, 30),
      };

      // Get existing reviews from KV
      const existing = await kv.get(REVIEWS_KEY) || [];
      const updated = [sanitized, ...existing];

      // Trim to max
      if (updated.length > MAX_REVIEWS) {
        updated.length = MAX_REVIEWS;
      }

      // Save back to KV
      await kv.set(REVIEWS_KEY, updated);

      return new Response(JSON.stringify(sanitized), {
        status: 201,
        headers: corsHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
  }

  // DELETE — admin only, requires secret
  if (request.method === 'DELETE') {
    const providedSecret = request.headers.get('X-Admin-Secret');

    if (providedSecret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    try {
      const { id } = await request.json();
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing review ID' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const existing = await kv.get(REVIEWS_KEY) || [];
      const updated = existing.filter(r => r.id !== id);

      await kv.set(REVIEWS_KEY, updated);

      return new Response(JSON.stringify({ success: true, deleted: id }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Delete failed' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: corsHeaders,
  });
}
