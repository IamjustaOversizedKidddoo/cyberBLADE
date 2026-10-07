import { createShell } from "@/lib/lab-engine/terminal/shell";
import { permWorld } from "../fixture-perms";

const sh = (user = "op") => createShell(permWorld(user));

test("only root may change the owner", () => {
  expect(sh().exec("chown bob run.sh")).toEqual({
    stdout: "",
    stderr: "chown: changing ownership of 'run.sh': Operation not permitted\n",
    code: 1,
  });
  const root = sh("root");
  expect(root.exec("chown bob:sudo /home/op/run.sh").code).toBe(0);
  expect(root.exec("ls -l /home/op/run.sh").stdout).toMatch(/^-rw-r--r-- 1 bob sudo /);
  root.exec("chown :adm /home/op/run.sh");
  expect(root.exec("ls -l /home/op/run.sh").stdout).toMatch(/ bob adm /);
});

test("changing the owner of a file clears setuid", () => {
  const root = sh("root");
  root.exec("chown op /usr/bin/tool");
  expect(root.exec("ls -l /usr/bin").stdout).toMatch(/^-rwxr-xr-x 1 op root /m);
});

test("unknown users and groups", () => {
  const root = sh("root");
  expect(root.exec("chown ghost /home/op/run.sh").stderr).toBe("chown: invalid user: 'ghost'\n");
  expect(root.exec("chown op:nogroup /home/op/run.sh").stderr).toBe("chown: invalid group: 'op:nogroup'\n");
  expect(root.exec("chgrp nogroup /home/op/run.sh").stderr).toBe("chgrp: invalid group: 'nogroup'\n");
});

test("chgrp: the owner may pick a group they belong to, and no other", () => {
  const s = sh();
  expect(s.exec("chgrp adm run.sh").code).toBe(0);
  expect(s.exec("ls -l run.sh").stdout).toMatch(/ op adm /);
  expect(s.exec("chgrp docker run.sh")).toEqual({
    stdout: "",
    stderr: "chgrp: changing group of 'run.sh': Operation not permitted\n",
    code: 1,
  });
});

test("-R recurses", () => {
  const root = sh("root");
  root.exec("chown -R bob /home/op/project");
  expect(root.exec("ls -l /home/op/project/sub").stdout).toMatch(/ bob op /);
});
