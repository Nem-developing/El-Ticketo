import { describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../test/utils";
import { api, ApiError, setUnauthorizedHandler, tokenStorage } from "./client";

describe("api client", () => {
  it("préfixe /api, répète les tableaux et ignore les filtres vides", async () => {
    const fetchMock = mockFetch(() => jsonResponse([]));
    await api.get("/tickets", {
      status: ["new", "waiting"],
      q: "",
      assignee_id: undefined,
      limit: 5,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "/api/tickets?status=new&status=waiting&limit=5",
    );
  });

  it("envoie le token et le corps JSON", async () => {
    tokenStorage.set("secret");
    const fetchMock = mockFetch(() => jsonResponse({ id: 1 }, 201));
    await api.post("/tickets", { title: "Imprimante" });
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    });
    expect(init.body).toBe('{"title":"Imprimante"}');
  });

  it.each([
    [jsonResponse({ detail: "Ticket introuvable." }, 404), 404, "Ticket introuvable."],
    [
      jsonResponse({ detail: [{ msg: "x" }] }, 422),
      422,
      "Certaines informations saisies sont invalides.",
    ],
    [
      new Response("Internal Server Error", { status: 500 }),
      500,
      "Le serveur a rencontré une erreur, réessayez dans un instant.",
    ],
  ])("normalise les erreurs (%#)", async (response, status, message) => {
    mockFetch(() => response);
    const error = await api.get("/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, message });
  });

  it("signale un serveur injoignable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.get("/x")).rejects.toMatchObject({
      status: 0,
      message: "Impossible de joindre le serveur.",
    });
  });

  it("met fin à la session une seule fois quand le token est refusé", async () => {
    tokenStorage.set("expired");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch(() => jsonResponse({ detail: "Session invalide ou expirée." }, 401));

    await Promise.allSettled([api.get("/a"), api.get("/b"), api.get("/c")]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(tokenStorage.get()).toBeNull();
    setUnauthorizedHandler(null);
  });

  it("n'appelle pas le gestionnaire pour un échec de connexion", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch(() => jsonResponse({ detail: "Identifiants incorrects." }, 401));

    await expect(api.post("/auth/login", {})).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    setUnauthorizedHandler(null);
  });
});
