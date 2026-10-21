import confetti from "canvas-confetti";

/** Petite célébration à la création d'un ticket (désactivée si l'utilisateur limite les animations). */
export function celebrate() {
  const defaults = { disableForReducedMotion: true, origin: { y: 0.7 }, zIndex: 2000 };
  void confetti({ ...defaults, particleCount: 90, spread: 70, startVelocity: 45 });
  void confetti({ ...defaults, particleCount: 50, spread: 110, decay: 0.92, scalar: 0.8 });
}
