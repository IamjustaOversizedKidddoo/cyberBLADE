You are tasked with auditing the network interface configuration on a workstation after a recent network upgrade.

Your objective is to inspect your host's local IP settings, identify your subnet parameters, and detect any unconfigured or disconnected interfaces.

**What to do**

1. Run `ip a` to examine your assigned IPv4 address and subnet prefix mask (CIDR notation).
2. Check `ip route` to locate the default gateway configured for forwarding outbound packets.
3. Calculate the number of usable host addresses on your local subnet using the formula `2^(32 - prefix) - 2`.
4. Inspect `ip link` to determine which physical interface is in a `DOWN` state.

This network environment is simulated and you are authorized to inspect all local interfaces.
