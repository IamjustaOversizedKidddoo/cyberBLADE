// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
vi.mock("@/app/(app)/feedback/actions", () => ({ submitFeedbackAction: vi.fn(async () => ({ ok: true, requestId: "r" })) }));
import { TerminalCheck } from "@/components/lesson/TerminalCheck";

const questions = [
  { id: "q1", prompt: "What does a CPU do?", options: ["Stores files", "Runs instructions", "Shows pictures"] },
  { id: "q2", prompt: "What is RAM?", options: ["Short-term memory", "A cable"] },
];

const explanations = ["No — that is storage.", "Yes — it executes instructions.", "No — that is the GPU's job."];

test("renders each question with radio options", () => {
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={vi.fn()} />);
  const q1 = screen.getByRole("group", { name: "What does a CPU do?" });
  expect(within(q1).getAllByRole("radio")).toHaveLength(3);
  expect(screen.getByRole("group", { name: "What is RAM?" })).toBeInTheDocument();
});

test("posts the chosen option and shows the verdict with every explanation", async () => {
  const answer = vi.fn().mockResolvedValue({ correct: false, explanations, lessonCompleted: false });
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={answer} />);
  const q1 = screen.getByRole("group", { name: "What does a CPU do?" });
  await userEvent.click(within(q1).getByRole("radio", { name: "Stores files" }));
  await userEvent.click(within(q1).getByRole("button", { name: "Check answer" }));
  expect(answer).toHaveBeenCalledWith("q1", 0);
  expect(await within(q1).findByText("Not quite")).toBeInTheDocument();
  for (const e of explanations) expect(within(q1).getByText(e)).toBeInTheDocument();
});

test("allows a retry and shows Correct", async () => {
  const answer = vi
    .fn()
    .mockResolvedValueOnce({ correct: false, explanations, lessonCompleted: false })
    .mockResolvedValueOnce({ correct: true, explanations, lessonCompleted: false });
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={answer} />);
  const q1 = screen.getByRole("group", { name: "What does a CPU do?" });
  await userEvent.click(within(q1).getByRole("radio", { name: "Stores files" }));
  await userEvent.click(within(q1).getByRole("button", { name: "Check answer" }));
  await within(q1).findByText("Not quite");
  await userEvent.click(within(q1).getByRole("radio", { name: "Runs instructions" }));
  await userEvent.click(within(q1).getByRole("button", { name: "Check answer" }));
  expect(await within(q1).findByText("Correct")).toBeInTheDocument();
  expect(answer).toHaveBeenLastCalledWith("q1", 1);
});

test("the check button needs a choice first", async () => {
  const answer = vi.fn();
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={answer} />);
  const q1 = screen.getByRole("group", { name: "What does a CPU do?" });
  expect(within(q1).getByRole("button", { name: "Check answer" })).toBeDisabled();
});

test("already-passed questions are marked", () => {
  render(<TerminalCheck questions={questions} initialPassed={["q2"]} answer={vi.fn()} />);
  expect(within(screen.getByRole("group", { name: "What is RAM?" })).getByText("Passed")).toBeInTheDocument();
});

test("announces lesson completion", async () => {
  const answer = vi.fn().mockResolvedValue({ correct: true, explanations, lessonCompleted: true });
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={answer} />);
  const q1 = screen.getByRole("group", { name: "What does a CPU do?" });
  await userEvent.click(within(q1).getByRole("radio", { name: "Runs instructions" }));
  await userEvent.click(within(q1).getByRole("button", { name: "Check answer" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/lesson complete/i);
});

test("exposes attempt count and result for automation", async () => {
  const answer = vi.fn().mockResolvedValue({ correct: false, explanations, lessonCompleted: false });
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={answer} />);
  const q1 = screen.getByRole("group", { name: "What does a CPU do?" });
  expect(q1).toHaveAttribute("data-result", "idle");
  await userEvent.click(within(q1).getByRole("radio", { name: "Stores files" }));
  await userEvent.click(within(q1).getByRole("button", { name: "Check answer" }));
  await within(q1).findByText("Not quite");
  expect(q1).toHaveAttribute("data-attempts", "1");
  expect(q1).toHaveAttribute("data-result", "wrong");
});

test("default variant keeps the uppercase terminal legend (core lessons unchanged)", () => {
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={vi.fn()} />);
  const legend = screen.getByText("What does a CPU do?");
  expect(legend.className).toContain("uppercase");
});

test("readable variant uses sentence-case legends (SOC track)", () => {
  render(<TerminalCheck questions={questions} initialPassed={[]} answer={vi.fn()} variant="readable" />);
  const legend = screen.getByText("What does a CPU do?");
  expect(legend.className).not.toContain("uppercase");
  expect(legend.className).toContain("font-sans");
});
