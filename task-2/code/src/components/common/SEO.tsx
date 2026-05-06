import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "profile";
  jsonLd?: Record<string, unknown> | null;
}

const setMeta = (selector: string, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const [k, v] = selector.replace(/[[\]"']/g, "").split("=");
    el.setAttribute(k.replace("meta", "").trim() || "name", v);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const upsert = (key: "name" | "property", keyVal: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${key}="${keyVal}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(key, keyVal);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const upsertLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

export const SEO = ({ title, description, image, url, type = "website", jsonLd }: SEOProps) => {
  useEffect(() => {
    const fullUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    document.title = title;
    if (description) upsert("name", "description", description);
    upsert("property", "og:title", title);
    if (description) upsert("property", "og:description", description);
    upsert("property", "og:type", type);
    if (image) upsert("property", "og:image", image);
    if (fullUrl) upsert("property", "og:url", fullUrl);

    upsert("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsert("name", "twitter:title", title);
    if (description) upsert("name", "twitter:description", description);
    if (image) upsert("name", "twitter:image", image);

    if (fullUrl) upsertLink("canonical", fullUrl);

    let scriptEl = document.getElementById("seo-jsonld") as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.type = "application/ld+json";
        scriptEl.id = "seo-jsonld";
        document.head.appendChild(scriptEl);
      }
      scriptEl.text = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, image, url, type, JSON.stringify(jsonLd)]);

  return null;
};

export default SEO;
