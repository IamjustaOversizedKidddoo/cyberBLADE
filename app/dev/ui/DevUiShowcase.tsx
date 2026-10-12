"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Badge, StatusBadge, RankBadge, SeverityBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { Callout } from "@/components/ui/Callout";
import { Kbd } from "@/components/ui/Kbd";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import {
  IconTerminal,
  IconPlay,
  IconCopy,
} from "@/components/ui/icons";

export function DevUiShowcase() {
  return (
    <main className="min-h-screen bg-canvas text-ink px-4 py-8 sm:px-8 max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan tracking-widest uppercase">
          <IconTerminal className="h-4 w-4" />
          <span>CYBERBLADE DESIGN SYSTEM V2 · HUD PRIMITIVES</span>
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl text-ink">
          TACTICAL UI SHOWCASE
        </h1>
        <p className="mt-2 text-muted text-sm max-w-2xl font-sans">
          Internal catalog of tokens and atomic components. Excluded from production builds.
        </p>
      </div>

      {/* 1. BUTTONS */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          1. Buttons & Controls
        </h2>
        <Card variant="raised">
          <CardBody className="space-y-6">
            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">Variants</div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary HUD</Button>
                <Button variant="ghost">Ghost Command</Button>
                <Button variant="danger">Abort Operation</Button>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">Sizes</div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium (Default)</Button>
                <Button variant="primary" size="lg">Large Mission</Button>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">States & Icon-Only</div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" loading>Loading...</Button>
                <Button variant="secondary" disabled>Disabled State</Button>
                <Button variant="secondary" iconOnly aria-label="Run command">
                  <IconPlay className="h-4 w-4" />
                </Button>
                <Button variant="ghost" iconOnly aria-label="Copy snippet">
                  <IconCopy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* 2. BADGES & CHIPS */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          2. Badges, Status & Ranks
        </h2>
        <Card variant="raised">
          <CardBody className="space-y-6">
            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">Standard Chips</div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="cyan">CYAN HUD</Badge>
                <Badge variant="purple">PURPLE LAB</Badge>
                <Badge variant="emerald">EMERALD PASS</Badge>
                <Badge variant="amber">AMBER WARN</Badge>
                <Badge variant="danger">DANGER ALERT</Badge>
                <Badge variant="outline">OUTLINE TAG</Badge>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">Curriculum Status Badges</div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="AVAILABLE" />
                <StatusBadge status="IN_PROGRESS" />
                <StatusBadge status="COMPLETED" />
                <StatusBadge status="LOCKED" />
              </div>
            </div>

            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">Operator Ranks</div>
              <div className="flex flex-wrap items-center gap-2">
                <RankBadge rank={0} />
                <RankBadge rank={1} />
                <RankBadge rank={2} />
                <RankBadge rank={3} />
              </div>
            </div>

            <div>
              <div className="text-xs text-muted font-ui uppercase mb-3">SIEM Severity Badges (Accessible Shapes)</div>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity="CRITICAL" />
                <SeverityBadge severity="HIGH" />
                <SeverityBadge severity="MEDIUM" />
                <SeverityBadge severity="LOW" />
                <SeverityBadge severity="INFO" />
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* 3. CARDS & PANELS */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          3. Panels & Card Hierarchy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="default" edge="cyan">
            <CardHeader>
              <span className="font-ui text-xs font-semibold text-cyan uppercase">Default Panel</span>
              <Badge variant="cyan" size="sm">ACTIVE</Badge>
            </CardHeader>
            <CardBody>
              <p className="text-xs text-muted leading-relaxed">
                Primary console card with subtle border and standard surface background.
              </p>
            </CardBody>
            <CardFooter>
              <span className="text-[11px] text-muted font-mono">ID: SEC-01</span>
              <Button variant="ghost" size="sm">Inspect</Button>
            </CardFooter>
          </Card>

          <Card variant="raised" edge="emerald">
            <CardHeader>
              <span className="font-ui text-xs font-semibold text-success uppercase">Raised Panel</span>
              <Badge variant="emerald" size="sm">SOLVED</Badge>
            </CardHeader>
            <CardBody>
              <p className="text-xs text-muted leading-relaxed">
                Elevated card with deepened background for higher visual prominence.
              </p>
            </CardBody>
            <CardFooter>
              <span className="text-[11px] text-muted font-mono">100 XP</span>
              <Button variant="secondary" size="sm">Review</Button>
            </CardFooter>
          </Card>

          <Card variant="subtle" edge="purple">
            <CardHeader>
              <span className="font-ui text-xs font-semibold text-purple uppercase">Subtle Panel</span>
              <Badge variant="purple" size="sm">OPTIONAL</Badge>
            </CardHeader>
            <CardBody>
              <p className="text-xs text-muted leading-relaxed">
                Darker inset surface for secondary tooling, logs or peripheral views.
              </p>
            </CardBody>
            <CardFooter>
              <span className="text-[11px] text-muted font-mono">PORT 443</span>
              <Button variant="ghost" size="sm">Connect</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* 4. PROGRESS BARS */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          4. Progress Indicators
        </h2>
        <Card variant="raised">
          <CardBody className="space-y-4">
            <ProgressBar value={25} label="Rank 1 Curriculum" showLabel variant="cyan" />
            <ProgressBar value={70} label="Network Traffic Inspected" showLabel variant="emerald" />
            <ProgressBar value={45} label="Challenge Cooldown" showLabel variant="amber" />
            <ProgressBar value={90} label="Exam Domain Readiness" showLabel variant="purple" />
          </CardBody>
        </Card>
      </section>

      {/* 5. TABS & KEYBOARD NAV */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          5. Accessible Tabs
        </h2>
        <Card variant="raised">
          <CardBody>
            <Tabs defaultValue="linux">
              <TabList aria-label="Terminal Environments">
                <Tab value="linux">Linux Bash</Tab>
                <Tab value="powershell">PowerShell 7</Tab>
                <Tab value="wireshark">Packet Inspector</Tab>
              </TabList>
              <TabPanel value="linux" className="text-xs font-mono text-muted">
                <div className="p-3 bg-surface-subtle border border-line/40 rounded-xs">
                  $ uname -a<br />
                  Linux cyberblade-node-1 6.5.0-generic #42-Ubuntu SMP x86_64
                </div>
              </TabPanel>
              <TabPanel value="powershell" className="text-xs font-mono text-muted">
                <div className="p-3 bg-surface-subtle border border-line/40 rounded-xs">
                  PS C:\&gt; Get-Service | Where-Object Status -eq &apos;Running&apos;
                </div>
              </TabPanel>
              <TabPanel value="wireshark" className="text-xs font-mono text-muted">
                <div className="p-3 bg-surface-subtle border border-line/40 rounded-xs">
                  Display Filter: tcp.port == 443 &amp;&amp; ssl.handshake
                </div>
              </TabPanel>
            </Tabs>
          </CardBody>
        </Card>
      </section>

      {/* 6. CALLOUTS & NOTICES */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          6. Callouts & Editorial Notes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Callout variant="info" title="OPERATOR BRIEF">
            Verify network interface IP configuration before initiating beacon listener.
          </Callout>
          <Callout variant="tip" title="TACTICAL TIP">
            Use <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> to terminate hanging subprocesses cleanly.
          </Callout>
          <Callout variant="warning" title="FIREWALL NOTICE">
            Egress rules on subnet 10.0.0.0/24 drop all outbound ICMP echo replies.
          </Callout>
          <Callout variant="danger" title="CONTAINMENT BREACH">
            Suspicious process detected injecting into winlogon.exe.
          </Callout>
        </div>
      </section>

      {/* 7. DATA TABLES */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          7. Dense HUD Tables
        </h2>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TIMESTAMP</TableHead>
                <TableHead>SEVERITY</TableHead>
                <TableHead>EVENT ID</TableHead>
                <TableHead>SOURCE IP</TableHead>
                <TableHead>MESSAGE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow selected>
                <TableCell className="font-mono text-muted">14:02:19.421</TableCell>
                <TableCell><SeverityBadge severity="CRITICAL" /></TableCell>
                <TableCell className="font-mono text-cyan">4625</TableCell>
                <TableCell className="font-mono">192.168.1.105</TableCell>
                <TableCell>An account failed to log on (NTLM brute-force)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-muted">14:02:18.110</TableCell>
                <TableCell><SeverityBadge severity="HIGH" /></TableCell>
                <TableCell className="font-mono text-cyan">7045</TableCell>
                <TableCell className="font-mono">10.0.0.12</TableCell>
                <TableCell>A service was installed in the system: PSSvc</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-muted">14:02:11.890</TableCell>
                <TableCell><SeverityBadge severity="INFO" /></TableCell>
                <TableCell className="font-mono text-cyan">4624</TableCell>
                <TableCell className="font-mono">127.0.0.1</TableCell>
                <TableCell>An account was successfully logged on</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </section>

      {/* 8. EMPTY & ERROR STATES */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          8. Empty & Error States
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmptyState
            title="NO LABS FOUND"
            description="No exercises match the selected filters. Try broadening your query or clearing MITRE tags."
            action={<Button variant="secondary" size="sm">Reset Filter Criteria</Button>}
          />
          <ErrorState
            title="ENGINE CRASH DETECTED"
            message="Terminal daemon disconnected unexpectedly during session execution. Code 137 (SIGKILL)."
            onRetry={() => {}}
            retryLabel="RESTART VM"
          />
        </div>
      </section>

      {/* 9. SKELETON LOADERS */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold tracking-wider text-cyan uppercase">
          9. Skeletons & Tooltips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <CardSkeleton />
          <Card variant="raised">
            <CardBody className="space-y-4">
              <div className="text-xs text-muted font-ui uppercase">Interactive Tooltips</div>
              <div className="flex items-center gap-4">
                <Tooltip content="Earned after completing all Rank 1 modules">
                  <Badge variant="cyan">PASSCODE BADGE</Badge>
                </Tooltip>
                <Tooltip content="Keyboard shortcut for quick search">
                  <Kbd>/</Kbd>
                </Tooltip>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </main>
  );
}
