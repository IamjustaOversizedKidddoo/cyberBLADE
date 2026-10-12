// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { StatusBadge, RankBadge, SeverityBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Dialog } from "@/components/ui/Dialog";

describe("UI Primitives", () => {
  describe("Button", () => {
    it("renders children and handles click", () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Deploy</Button>);
      const btn = screen.getByRole("button", { name: "Deploy" });
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("respects disabled state", () => {
      const onClick = vi.fn();
      render(<Button disabled onClick={onClick}>Locked</Button>);
      const btn = screen.getByRole("button", { name: "Locked" });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("renders loading state with aria-busy", () => {
      render(<Button loading>Processing</Button>);
      const btn = screen.getByRole("button");
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toBeDisabled();
    });
  });

  describe("Badge & StatusBadge", () => {
    it("renders status badges with appropriate text", () => {
      render(
        <div>
          <StatusBadge status="AVAILABLE" />
          <StatusBadge status="COMPLETED" />
          <StatusBadge status="LOCKED" />
          <StatusBadge status="IN_PROGRESS" />
        </div>
      );
      expect(screen.getByText("AVAILABLE")).toBeInTheDocument();
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
      expect(screen.getByText("LOCKED")).toBeInTheDocument();
      expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();
    });

    it("renders rank badges", () => {
      render(<RankBadge rank={1} />);
      expect(screen.getByText("Operator")).toBeInTheDocument();
      expect(screen.getByText("R1")).toBeInTheDocument();
    });

    it("renders severity badges for SIEM", () => {
      render(<SeverityBadge severity="CRITICAL" />);
      expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    });
  });

  describe("ProgressBar", () => {
    it("renders accessible role and values", () => {
      render(<ProgressBar value={45} label="Mission Progress" showLabel />);
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "45");
      expect(screen.getByText("45%")).toBeInTheDocument();
      expect(screen.getByText("Mission Progress")).toBeInTheDocument();
    });
  });

  describe("Tabs", () => {
    it("cycles active tabs with keyboard arrows", () => {
      render(
        <Tabs defaultValue="t1">
          <TabList aria-label="Terminal Tabs">
            <Tab value="t1">Tab 1</Tab>
            <Tab value="t2">Tab 2</Tab>
          </TabList>
          <TabPanel value="t1">Panel 1 Content</TabPanel>
          <TabPanel value="t2">Panel 2 Content</TabPanel>
        </Tabs>
      );

      expect(screen.getByText("Panel 1 Content")).toBeInTheDocument();
      expect(screen.queryByText("Panel 2 Content")).not.toBeInTheDocument();

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      expect(tab2).toBeInTheDocument();

      tab1.focus();
      fireEvent.keyDown(tab1, { key: "ArrowRight" });

      expect(screen.getByText("Panel 2 Content")).toBeInTheDocument();
      expect(screen.queryByText("Panel 1 Content")).not.toBeInTheDocument();
    });
  });

  describe("Card", () => {
    it("renders structured panel segments", () => {
      render(
        <Card variant="raised" edge="cyan">
          <CardHeader>Header Content</CardHeader>
          <CardBody>Body Content</CardBody>
          <CardFooter>Footer Content</CardFooter>
        </Card>
      );
      expect(screen.getByText("Header Content")).toBeInTheDocument();
      expect(screen.getByText("Body Content")).toBeInTheDocument();
      expect(screen.getByText("Footer Content")).toBeInTheDocument();
    });
  });

  describe("Callout", () => {
    it("renders note role and content", () => {
      render(<Callout variant="warning" title="WARNING NOTICE">Caution text</Callout>);
      expect(screen.getByRole("note")).toBeInTheDocument();
      expect(screen.getByText("WARNING NOTICE")).toBeInTheDocument();
      expect(screen.getByText("Caution text")).toBeInTheDocument();
    });
  });

  describe("EmptyState & ErrorState", () => {
    it("renders empty state", () => {
      render(<EmptyState title="NO TELEMETRY" description="Check sensor configuration" />);
      expect(screen.getByText("NO TELEMETRY")).toBeInTheDocument();
      expect(screen.getByText("Check sensor configuration")).toBeInTheDocument();
    });

    it("renders error state with retry button", () => {
      const onRetry = vi.fn();
      render(<ErrorState title="CONNECTION FAILED" message="Timeout" onRetry={onRetry} />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: /RETRY OPERATION/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dialog", () => {
    it("handles close on escape", () => {
      const onClose = vi.fn();
      render(<Dialog open={true} onClose={onClose} title="SYSTEM DIALOG">Modal Content</Dialog>);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("SYSTEM DIALOG")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
