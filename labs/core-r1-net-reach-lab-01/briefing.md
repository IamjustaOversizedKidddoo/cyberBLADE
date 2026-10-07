A list of internal critical infrastructure hosts has been placed in your home folder at `~/servers.txt`.

Your job is to test end-to-end reachability, trace the network path to an external reporting beacon, and inspect your local layer 2 neighbor cache.

**What to do**

1. Read `~/servers.txt` and use `ping -c 1 <server>` to verify which server is unresponsive.
2. Use `traceroute beacon.example` to measure the hop count across the intervening routers.
3. Check the ARP/neighbor table with `ip neigh` to discover the MAC address of your local router/gateway.

This network environment is simulated and you are authorized to inspect connectivity to all listed hosts.
