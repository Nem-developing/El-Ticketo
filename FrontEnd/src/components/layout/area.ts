/** L'administration a son propre menu, sans les pages du projet courant. */
export const isAdminArea = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/");
