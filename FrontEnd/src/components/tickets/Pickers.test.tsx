import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { TicketPriority } from "../../api/types";
import { CategoryPicker, PriorityPicker } from "./Pickers";

function CategoryHarness() {
  const [category, setCategory] = useState("");
  return (
    <>
      <CategoryPicker value={category} onChange={setCategory} />
      <output data-testid="value">{category}</output>
    </>
  );
}

describe("CategoryPicker", () => {
  it("sélectionne une catégorie proposée en un clic", async () => {
    render(<CategoryHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Bug" }));
    expect(screen.getByTestId("value")).toHaveTextContent("Bug");
    expect(screen.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "true");
  });

  it("« Autre » vaut « Autre » tant que rien n'est précisé", async () => {
    render(<CategoryHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Autre…" }));
    expect(screen.getByTestId("value")).toHaveTextContent("Autre");

    await userEvent.type(screen.getByLabelText("Préciser la catégorie"), "Matériel");
    expect(screen.getByTestId("value")).toHaveTextContent("Matériel");

    await userEvent.clear(screen.getByLabelText("Préciser la catégorie"));
    expect(screen.getByTestId("value")).toHaveTextContent("Autre");
  });
});

describe("PriorityPicker", () => {
  it("propose trois priorités au clavier comme à la souris", async () => {
    function Harness() {
      const [priority, setPriority] = useState<TicketPriority>("normal");
      return <PriorityPicker value={priority} onChange={setPriority} />;
    }
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Normale" })).toBeChecked();
    await userEvent.click(screen.getByText("Haute"));
    expect(screen.getByRole("radio", { name: "Haute" })).toBeChecked();
  });
});
