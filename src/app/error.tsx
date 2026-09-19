"use client";
import { useEffect } from "react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => { /* Error details are intentionally not rendered to visitors. */ }, []); return <section className="error-page shell"><p className="eyebrow">Incident temporaire</p><h1>La page n’a pas pu être chargée.</h1><p>Notre équipe a été informée. Vous pouvez réessayer sans perdre votre navigation.</p><button className="primary-button" onClick={reset}>Réessayer</button></section>; }
