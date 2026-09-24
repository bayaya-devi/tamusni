"use client";

import { useEffect, useState } from "react";

export function ScrollNavigator() {
  const [goToTop, setGoToTop] = useState(false);
  useEffect(() => {
    const update = () => setGoToTop(window.scrollY > Math.max(320, (document.documentElement.scrollHeight - window.innerHeight) / 2));
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  function navigate() { window.scrollTo({ top: goToTop ? 0 : document.documentElement.scrollHeight, behavior: "smooth" }); }
  return <button type="button" className="scroll-navigator" onClick={navigate} aria-label={goToTop ? "Revenir en haut de la page" : "Aller en bas de la page"} title={goToTop ? "Haut de page" : "Bas de page"}>{goToTop ? "↑" : "↓"}</button>;
}
