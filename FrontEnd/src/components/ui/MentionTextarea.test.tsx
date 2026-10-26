import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ALICE, jsonResponse, mockFetch, renderPage } from "../../test/utils";
import { MentionTextarea } from "./MentionTextarea";

const ALBERT = { ...ALICE, id: 3, username: "albert" };
const BOB = { ...ALICE, id: 4, username: "bob" };
const FORMER = { ...ALICE, id: 5, username: "alain", is_active: false };

function Editor() {
  const [value, setValue] = useState("");
  return <MentionTextarea aria-label="Texte" value={value} onChange={setValue} />;
}

function renderEditor() {
  mockFetch((_, url) =>
    url.pathname === "/api/users"
      ? jsonResponse([ALICE, ALBERT, BOB, FORMER])
      : jsonResponse([{ id: 42, title: `Imprimante (${url.searchParams.get("q")})` }]),
  );
  renderPage(<Editor />, { path: "/" });
  return screen.getByLabelText("Texte");
}

describe("MentionTextarea", () => {
  it("propose les personnes actives après @, sans soi-même", async () => {
    const textarea = renderEditor();

    await userEvent.type(textarea, "Merci @al");
    expect(await screen.findByRole("option", { name: "@albert" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(1);

    await userEvent.keyboard("{Enter}");
    expect(textarea).toHaveValue("Merci @albert ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("propose les tickets après #, recherchés par n° ou par titre", async () => {
    const textarea = renderEditor();

    await userEvent.type(textarea, "Voir #impri");
    await userEvent.click(await screen.findByRole("option", { name: "#42 Imprimante (impri)" }));
    expect(textarea).toHaveValue("Voir #42 ");
  });

  it("Échap ferme les suggestions et laisse Entrée aller à la ligne", async () => {
    const textarea = renderEditor();

    await userEvent.type(textarea, "@b");
    await screen.findByRole("option", { name: "@bob" });
    await userEvent.keyboard("{Escape}{Enter}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(textarea).toHaveValue("@b\n");
  });
});
