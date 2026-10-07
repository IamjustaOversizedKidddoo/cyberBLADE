import { netRun } from "../fixture-network";

test("prints the body", () => {
  expect(netRun("curl http://example.com/")).toEqual({ stdout: "<h1>Example</h1>\n", stderr: "", code: 0 });
  expect(netRun("curl example.com").stdout).toBe("<h1>Example</h1>\n");
});

test("-I prints the status line and headers", () => {
  expect(netRun("curl -I http://example.com/").stdout).toBe(
    "HTTP/1.1 200 OK\nServer: nginx/1.24.0\nContent-Type: text/html\n\n",
  );
});

test("redirects are shown, and followed with -L", () => {
  expect(netRun("curl -I http://intranet.corp.example/").stdout).toBe(
    "HTTP/1.1 301 Moved Permanently\nServer: Apache/2.4.58\nLocation: /home\n\n",
  );
  expect(netRun("curl -L http://intranet.corp.example/").stdout).toBe("Welcome to the intranet\n");
  expect(netRun("curl -sIL http://intranet.corp.example/").stdout).toBe(
    "HTTP/1.1 301 Moved Permanently\nServer: Apache/2.4.58\nLocation: /home\n\n" +
      "HTTP/1.1 200 OK\nServer: Apache/2.4.58\nContent-Type: text/plain\n\n",
  );
});

test("unknown path is a 404 from that server", () => {
  expect(netRun("curl -I http://example.com/missing").stdout).toBe("HTTP/1.1 404 Not Found\nServer: nginx/1.24.0\n\n");
});

test("errors use curl's codes and wording", () => {
  expect(netRun("curl http://nosuch.example/")).toEqual({ stdout: "", stderr: "curl: (6) Could not resolve host: nosuch.example\n", code: 6 });
  expect(netRun("curl http://dead.example.net/")).toEqual({
    stdout: "",
    stderr: "curl: (7) Failed to connect to dead.example.net port 80 after 3 ms: Couldn't connect to server\n",
    code: 7,
  });
  expect(netRun("curl http://intranet.corp.example:8080/").stderr).toBe(
    "curl: (7) Failed to connect to intranet.corp.example port 8080 after 3 ms: Couldn't connect to server\n",
  );
  expect(netRun("curl")).toEqual({ stdout: "", stderr: "curl: try 'curl --help' for more information\n", code: 2 });
});
