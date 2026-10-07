A network tap captured authentication traffic crossing an unencrypted local Wi-Fi segment, followed by an encrypted TLS connection.

Your mission is to perform deep packet inspection to recover credentials sent in clear text, extract the session flag, and identify the encrypted destination reached via TLS.

**What to do**

1. Find the clear-text HTTP authentication request (`http.request.method == "POST"`) and identify the username submitted.
2. Follow the TCP stream or inspect the HTTP response (`http.response.code == 200`) to recover the admin verification flag.
3. Filter for TLS traffic (`tls` or `tls.handshake.extensions_server_name`) to discover the secure server hostname requested via SNI.

This packet trace is a simulated capture and you are authorized to inspect all communications.
