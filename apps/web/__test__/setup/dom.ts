import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { sessionStore } from "@/shared/lib/session-store";

// APIs del navegador que jsdom no implementa y que usa la app.
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverFalso as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }) as MediaQueryList;

// Sin `globals`, Testing Library no limpia sola: se desmonta todo después de cada prueba.
afterEach(() => {
  cleanup();
  sessionStore.clear();
  localStorage.clear();
  sessionStorage.clear();
});
