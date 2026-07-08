import { AppError } from "./types";

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
      ...CORS_HEADERS,
      ...(init.headers || {})
    }
  });
}

export function textResponse(text: string, init: ResponseInit = {}): Response {
  return new Response(text, {
    ...init,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...SECURITY_HEADERS,
      ...CORS_HEADERS,
      ...(init.headers || {})
    }
  });
}

export function svgResponse(svg: string, cacheTtlSeconds: number): Response {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheTtlSeconds}, stale-while-revalidate=604800`,
      ...SECURITY_HEADERS,
      ...CORS_HEADERS
    }
  });
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      ...CORS_HEADERS
    }
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.expose ? error.message : "Internal Server Error"
        }
      },
      { status: error.status }
    );
  }

  console.error(error);

  return jsonResponse(
    {
      error: {
        code: "internal_error",
        message: "Internal Server Error"
      }
    },
    { status: 500 }
  );
}
