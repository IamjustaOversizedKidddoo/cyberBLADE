import { parseSudoers, rulesFor, type Rule } from "@/lib/lab-engine/terminal/sudoers";

const SUDOERS_SAMPLE = `
# /etc/sudoers
Defaults env_reset
Defaults mail_badpass
Defaults secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"
Defaults use_pty

# User privilege specification
root ALL=(ALL:ALL) ALL

# Members of the admin group may gain root privileges
%admin ALL=(ALL) ALL

# Allow members of group sudo to execute any command
%sudo ALL=(ALL:ALL) ALL

# Custom user rules
learner ALL=(root) NOPASSWD: /usr/bin/find, /usr/bin/systemctl status *
alice ALL=(ALL) /usr/bin/cat
#includedir /etc/sudoers.d
`;

test("parseSudoers parses defaults and rule variants", () => {
  const { defaults, rules } = parseSudoers(SUDOERS_SAMPLE);
  expect(defaults).toEqual([
    "env_reset",
    "mail_badpass",
    'secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"',
    "use_pty",
  ]);

  expect(rules).toContainEqual<Rule>({
    who: "root",
    runAs: "ALL:ALL",
    nopasswd: false,
    commands: ["ALL"],
  });

  expect(rules).toContainEqual<Rule>({
    who: "%sudo",
    runAs: "ALL:ALL",
    nopasswd: false,
    commands: ["ALL"],
  });

  expect(rules).toContainEqual<Rule>({
    who: "learner",
    runAs: "root",
    nopasswd: true,
    commands: ["/usr/bin/find", "/usr/bin/systemctl status *"],
  });

  expect(rules).toContainEqual<Rule>({
    who: "alice",
    runAs: "ALL",
    nopasswd: false,
    commands: ["/usr/bin/cat"],
  });
});

test("rulesFor returns rules matching username or group membership", () => {
  const { rules } = parseSudoers(SUDOERS_SAMPLE);

  const learnerRules = rulesFor(rules, "learner", ["learner"]);
  expect(learnerRules).toHaveLength(1);
  expect(learnerRules[0].who).toBe("learner");
  expect(learnerRules[0].nopasswd).toBe(true);

  const sudoMemberRules = rulesFor(rules, "bob", ["bob", "sudo"]);
  expect(sudoMemberRules).toHaveLength(1);
  expect(sudoMemberRules[0].who).toBe("%sudo");

  const unprivileged = rulesFor(rules, "nobody", ["nogroup"]);
  expect(unprivileged).toEqual([]);
});
