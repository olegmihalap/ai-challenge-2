import { Outlet } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export const PublicLayout = () => (
  <div className="flex min-h-screen flex-col">
    <SiteHeader />
    <main className="flex-1"><Outlet /></main>
    <SiteFooter />
  </div>
);

export const AuthedLayout = PublicLayout;
