export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type HttpRequest = {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
};

export type HttpResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
};

export type HttpExchange = {
  request: HttpRequest;
  response: HttpResponse;
};

export type WebAppEnv = {
  appId: string;
  name: string;
  baseUrl: string;
  initialUrl: string;
  initialCookies?: Record<string, string>;
  initialStorage?: Record<string, string>;
  database: Record<string, Array<Record<string, unknown>>>;
  config: Record<string, unknown>;
};
