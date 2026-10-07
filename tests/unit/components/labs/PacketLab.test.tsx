// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PacketLab } from "@/components/labs/packet/PacketLab";
import { FIXTURE_CAPTURE } from "../../lib/lab-engine/packet/fixture-capture";

describe("PacketLab component", () => {
  it("renders all packets and status line Displayed: 12 of 12", () => {
    render(<PacketLab capture={FIXTURE_CAPTURE} />);
    expect(screen.getByText("Displayed: 12 of 12 packets")).toBeInTheDocument();
    // Verify columns exist
    expect(screen.getByText("No.")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Destination")).toBeInTheDocument();
    expect(screen.getByText("Protocol")).toBeInTheDocument();
    expect(screen.getByText("Length")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("applying dns filter shows only DNS rows and Displayed: 2 of 12 packets", async () => {
    render(<PacketLab capture={FIXTURE_CAPTURE} />);
    const input = screen.getByPlaceholderText(/apply a display filter/i);
    await userEvent.clear(input);
    await userEvent.type(input, "dns{enter}");

    expect(screen.getByText("Displayed: 2 of 12 packets")).toBeInTheDocument();
    expect(screen.getByText("Standard query 0x1a2b A example.com")).toBeInTheDocument();
    expect(screen.queryByText("Who has 10.0.2.2? Tell 10.0.2.15")).not.toBeInTheDocument();
  });

  it("invalid filter shows the exact error in role=alert and keeps the last good list", async () => {
    render(<PacketLab capture={FIXTURE_CAPTURE} />);
    const input = screen.getByPlaceholderText(/apply a display filter/i);
    await userEvent.clear(input);
    await userEvent.type(input, "ip.addr = 1.2.3.4{enter}");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent('"=" is not a valid operator — use "=="');
    // Keeps previous 12 packets
    expect(screen.getByText("Displayed: 12 of 12 packets")).toBeInTheDocument();
  });

  it("clicking an HTTP packet shows a Hypertext Transfer Protocol section in details", async () => {
    render(<PacketLab capture={FIXTURE_CAPTURE} />);
    const httpRow = screen.getByText("POST /login HTTP/1.1");
    await userEvent.click(httpRow);

    expect(screen.getByText("Hypertext Transfer Protocol")).toBeInTheDocument();
    expect(screen.getByText(/request method: post/i)).toBeInTheDocument();
  });

  it("clicking Follow TCP stream on a TCP packet shows StreamView with request line and back button", async () => {
    render(<PacketLab capture={FIXTURE_CAPTURE} />);
    const httpRow = screen.getByText("POST /login HTTP/1.1");
    await userEvent.click(httpRow);

    const followBtn = screen.getByRole("button", { name: /follow tcp stream/i });
    await userEvent.click(followBtn);

    expect(screen.getByText(/POST \/login HTTP\/1\.1/)).toBeInTheDocument();
    const backBtn = screen.getByRole("button", { name: /back to packets/i });
    expect(backBtn).toBeInTheDocument();

    await userEvent.click(backBtn);
    expect(screen.getByText("Displayed: 12 of 12 packets")).toBeInTheDocument();
  });
});

describe("PacketLab never moves the page by itself", () => {
  it("opening the lab and applying a filter do not scroll anything into view", async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(<PacketLab capture={FIXTURE_CAPTURE} />);
    const input = screen.getByPlaceholderText(/apply a display filter/i);
    await userEvent.clear(input);
    await userEvent.type(input, "dns{enter}");
    expect(spy).not.toHaveBeenCalled();
  });
});
