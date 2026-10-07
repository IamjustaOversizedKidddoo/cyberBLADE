/** Accounts and groups used by identity and permission tests. */
export const PASSWD =
  "root:x:0:0:root:/root:/bin/bash\n" +
  "op:x:1000:1000:Op User:/home/op:/bin/bash\n" +
  "bob:x:1001:1001:bob:/home/bob:/bin/bash\n" +
  "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n";
export const GROUP = "root:x:0:\nadm:x:4:op\nsudo:x:27:op,bob\nwww-data:x:33:\nop:x:1000:\nbob:x:1001:\ndocker:x:999:bob\n";
