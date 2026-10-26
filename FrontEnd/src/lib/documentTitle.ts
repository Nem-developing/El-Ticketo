import { useEffect } from "react";

// Titre de l'onglet : la page affichée, précédé du nombre de notifications non lues, pour les
// voir arriver depuis un autre onglet.
const APP_NAME = "El Ticketo";
let page = "";
let unread = 0;

function apply() {
  const title = page ? `${page} · ${APP_NAME}` : APP_NAME;
  document.title = unread > 0 ? `(${unread}) ${title}` : title;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    page = title;
    apply();
    return () => {
      page = "";
      apply();
    };
  }, [title]);
}

export function useUnreadInTitle(count: number) {
  useEffect(() => {
    unread = count;
    apply();
    return () => {
      unread = 0;
      apply();
    };
  }, [count]);
}
