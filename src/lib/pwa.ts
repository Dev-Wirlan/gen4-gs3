import { registerSW } from "virtual:pwa-register";

const previewHosts = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];

const shouldRefuse = () => {
  const host = window.location.hostname;
  return !import.meta.env.PROD || window.self !== window.top || host.startsWith("id-preview--") || host.startsWith("preview--") ||
    previewHosts.some((domain) => host === domain || host.endsWith(`.${domain}`)) || new URLSearchParams(window.location.search).get("sw") === "off";
};

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((registration) => registration.active?.scriptURL.endsWith("/sw.js")).map((registration) => registration.unregister()));
}

export async function initializePwa() {
  if (!("serviceWorker" in navigator)) return;
  if (shouldRefuse()) { await unregisterAppWorker(); return; }
  registerSW({ immediate: true });
}