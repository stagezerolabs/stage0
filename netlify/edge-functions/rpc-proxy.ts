const RPC_URLS: Record<string, string> = {
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
};

export default async (request: Request) => {
  const url = new URL(request.url);
  const network = url.pathname.replace("/api/rpc/", "");
  const target = RPC_URLS[network];

  if (!target) {
    return new Response("Unknown network", { status: 404 });
  }

  const body = await request.text();

  const resp = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await resp.text();

  return new Response(data, {
    status: resp.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

export const config = {
  path: ["/api/rpc/*"],
};
