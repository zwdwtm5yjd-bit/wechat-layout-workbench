import { createServer, request as requestHttp, type IncomingHttpHeaders } from "node:http";
import { connect } from "node:net";

import {
  createPinnedLookup,
  resolvePublicWebUrl,
  systemHostResolver,
  type HostResolver,
} from "@wechat-layout/webpage-import";

function forwardHeaders(headers: IncomingHttpHeaders, hostname: string): IncomingHttpHeaders {
  const forwarded: Record<string, string | string[] | undefined> = { ...headers, host: hostname };
  delete forwarded["proxy-authorization"];
  delete forwarded["proxy-connection"];
  delete forwarded.connection;
  return forwarded;
}

export interface SafeProxy {
  readonly url: string;
  close(): Promise<void>;
}

export async function startSafeProxy(
  resolver: HostResolver = systemHostResolver,
): Promise<SafeProxy> {
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      if (!incoming.url) throw new Error("代理请求缺少 URL");
      const target = new URL(incoming.url);
      if (target.protocol !== "http:") throw new Error("代理仅允许 HTTP 转发");
      const resolved = await resolvePublicWebUrl(target, resolver);
      const pinned = resolved.addresses[0];
      if (pinned === undefined) throw new Error("域名没有可用地址");
      const request = requestHttp(
        {
          protocol: "http:",
          hostname: resolved.url.hostname.startsWith("[")
            ? resolved.url.hostname.slice(1, -1)
            : resolved.url.hostname,
          port: resolved.url.port === "" ? undefined : Number(resolved.url.port),
          method: incoming.method,
          path: `${resolved.url.pathname}${resolved.url.search}`,
          headers: forwardHeaders(incoming.headers, resolved.url.host),
          agent: false,
          lookup: createPinnedLookup(pinned),
        },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
        },
      );
      request.setTimeout(30_000, () => request.destroy(new Error("代理请求超时")));
      request.once("error", () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
      });
      incoming.pipe(request);
    })().catch(() => {
      if (!outgoing.headersSent) outgoing.writeHead(403);
      outgoing.end();
    });
  });

  server.on("connect", (request, client, head) => {
    void (async () => {
      const authority = request.url;
      if (!authority) throw new Error("CONNECT 缺少目标");
      const target = new URL(`https://${authority}`);
      const resolved = await resolvePublicWebUrl(target, resolver);
      const pinned = resolved.addresses[0];
      if (pinned === undefined) throw new Error("域名没有可用地址");
      const port = Number(target.port || "443");
      const upstream = connect({ host: pinned.address, port, family: pinned.family });
      upstream.setTimeout(30_000, () => upstream.destroy());
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.byteLength > 0) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.once("error", () => client.destroy());
      client.once("error", () => upstream.destroy());
    })().catch(() => {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("无法获取安全代理端口");
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
