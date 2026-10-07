A packet capture was recorded by an intrusion detection sensor monitoring inbound perimeter traffic. Security alarms indicate that an external system executed a TCP port scan against an internal server.

Your job is to analyze the packet trace to identify the adversary's IP, determine the attack scope, and identify open services discovered by the scan.

**What to do**

1. Filter the packet capture for TCP SYN probes (`tcp.flags.syn == 1 && tcp.flags.ack == 0`) to determine the scanner's source IP address and the total number of ports probed.
2. Filter for TCP SYN-ACK replies (`tcp.flags.syn == 1 && tcp.flags.ack == 1`) returned by the target host to determine which ports were open.
3. Submit the discovered IP address, comma-separated ascending open ports list, and total probe count.

This packet trace is a simulated capture and you are authorized to inspect all traffic.
