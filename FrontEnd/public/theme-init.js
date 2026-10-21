// Applique le thème choisi avant le premier affichage (évite un flash du thème clair).
// Fichier séparé plutôt qu'inline : la politique de sécurité (CSP) n'autorise que les scripts du site.
try {
  var theme = localStorage.getItem("elticketo.theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch (error) {
  // Stockage indisponible : thème du système.
}
