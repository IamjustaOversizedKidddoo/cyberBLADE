// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { proseComponents } from "@/components/lesson/prose";

const Table = proseComponents.table as (p: { children: React.ReactNode }) => React.ReactElement;

test("wide lesson tables sit in a labelled, keyboard-focusable scroll region", async () => {
  render(
    <>
      <button type="button">before</button>
      <Table>
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
      </Table>
    </>,
  );
  const region = screen.getByRole("region", { name: /table/i });
  expect(region).toHaveAttribute("tabindex", "0");
  expect(region.querySelector("table")).not.toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "before" }));
  await userEvent.tab();
  expect(region).toHaveFocus();
});
