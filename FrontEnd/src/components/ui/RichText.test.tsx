import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ALICE, jsonResponse, mockFetch, renderPage } from "../../test/utils";
import { RichText } from "./RichText";

const BOB = { ...ALICE, id: 3, username: "bob" };

function renderText(text: string) {
  mockFetch(() => jsonResponse([ALICE, BOB]));
  return renderPage(
    <p data-testid="text">
      <RichText text={text} />
    </p>,
    { path: "/" },
  );
}

describe("RichText", () => {
  it("rend les adresses web cliquables, sans la ponctuation qui les suit", () => {
    renderText("Voir https://exemple.fr/doc?id=4. Et (http://intranet/wiki#12)");

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://exemple.fr/doc?id=4",
      "http://intranet/wiki#12",
    ]);
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("ne fait de lien qu'avec une adresse http(s)", () => {
    renderText("javascript:alert(1) ou www.exemple.fr");

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("relie les #42 au ticket", () => {
    renderText("Même souci que #42, pas comme&#43; ni C#7.");

    expect(screen.getByRole("link", { name: "#42" })).toHaveAttribute("href", "/tickets/42");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("affiche les blocs de code tels quels, puis en couleur", async () => {
    renderText("Avant\n```python\nprint('@bob #42')\n```\nAprès `x = 1` et ```ls -l```");

    const blocks = document.querySelectorAll("pre.code-block");
    expect([...blocks].map((block) => block.textContent)).toEqual(["print('@bob #42')", "ls -l"]);
    expect(screen.getByText("x = 1").tagName).toBe("CODE");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector(".mention")).toBeNull();
    // Le premier bloc annonce son langage : il est coloré une fois le module chargé.
    await waitFor(() => expect(blocks[0].querySelector(".hljs-built_in")).not.toBeNull());
    expect(blocks[0].textContent).toBe("print('@bob #42')");
    expect(screen.getByTestId("text")).toHaveTextContent(/^Avant.*Après x = 1 et ls -l$/);
  });

  it("met en évidence les @identifiant des personnes existantes", async () => {
    renderText("@bob et @Alice. Pas @inconnu ni bob@exemple.fr");

    expect(await screen.findByText("@bob")).toHaveClass("mention");
    expect(screen.getByText("@Alice")).toHaveClass("mention", "mention--me");
    expect(screen.getByTestId("text")).toHaveTextContent(
      "@bob et @Alice. Pas @inconnu ni bob@exemple.fr",
    );
    expect(document.querySelectorAll(".mention")).toHaveLength(2);
  });
});
