import type { NextRequest } from "next/server";

const backendUrl = () =>
  (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");

async function proxy(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  const { path } = await context.params;
  const target = new URL(`/api/${path.join("/")}`, backendUrl());
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "No fue posible conectar con el servicio de la granja." },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const OPTIONS = proxy;
