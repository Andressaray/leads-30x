import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { sessionStore } from "@/shared/lib/session-store";

// Browser APIs that jsdom does not implement and the app uses.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= FakeResizeObserver as unknown as typeof ResizeObserver;
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

// Without `globals`, Testing Library does not clean up on its own: everything is unmounted after each test.
afterEach(() => {
  cleanup();
  sessionStore.clear();
  localStorage.clear();
  sessionStorage.clear();
});
