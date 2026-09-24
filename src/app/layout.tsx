import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./interface.css";
import "./brand.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollNavigator } from "@/components/ScrollNavigator";
export const metadata: Metadata = { title: "TAMUSNI — Technologies • Sciences • Futur", description: "La revue qui sélectionne, vérifie et explique les technologies qui transforment le monde.", metadataBase: new URL("https://tamusni.com"), openGraph: { type: "website", siteName: "TAMUSNI", title: "TAMUSNI — Technologies • Sciences • Futur" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body><a className="skip-link" href="#main">Aller au contenu</a><Header/><main id="main">{children}</main><Footer/><ScrollNavigator/></body></html>; }
