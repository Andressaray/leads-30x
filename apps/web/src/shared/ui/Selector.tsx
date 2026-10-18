// Dropdown list with the app's style (avatar, detail, selected mark). Accessible:
// button + listbox with arrows, Home/End, Enter/Space, Escape and first-letter search.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface SelectorOption {
  value: string;
  label: string;
  /** Second line, more muted. */
  detail?: string;
  /** Goes before the text (avatar, icon). */
  start?: ReactNode;
  /** Goes at the end of the row ("Tú" label, count…). */
  end?: ReactNode;
  /** Draws a divider line after this option. */
  separated?: boolean;
}

interface SelectorProps {
  label: string;
  options: SelectorOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Button text when the value is not among the options. */
  placeholder?: string;
  className?: string;
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const Chevron = () => (
  <svg className="selector-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Check = () => (
  <svg className="selector-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function Text({ option }: { option: SelectorOption }) {
  return (
    <span className="selector-text">
      <span className="selector-title">{option.label}</span>
      {option.detail && <span className="selector-detail">{option.detail}</span>}
    </span>
  );
}

export function Selector({ label, options, value, onChange, disabled, placeholder = "Elige una opción…", className }: SelectorProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const optionId = (i: number) => `${id}-op-${i}`;

  // On open: focus on the list and close with a click outside.
  useEffect(() => {
    if (!isOpen) return;
    list.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOpen]);

  // The active option always in view.
  useEffect(() => {
    if (isOpen) document.getElementById(`${id}-op-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [isOpen, active, id]);

  function open() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setIsOpen(true);
  }

  function close(focusButton = true) {
    setIsOpen(false);
    if (focusButton) button.current?.focus();
  }

  function choose(i: number) {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    close();
  }

  function buttonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      open();
    }
  }

  function listKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          // Jumps to the next option that starts with that letter.
          const letter = stripAccents(e.key);
          for (let step = 1; step <= options.length; step++) {
            const i = (active + step) % options.length;
            if (stripAccents(options[i].label).startsWith(letter)) {
              setActive(i);
              break;
            }
          }
        }
    }
  }

  return (
    <div ref={root} className={cn("selector", isOpen && "open", className)}>
      <span className="selector-label" id={`${id}-etq`}>
        {label}
      </span>
      <button
        ref={button}
        type="button"
        className="selector-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-lista` : undefined}
        aria-labelledby={`${id}-etq ${id}-val`}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={buttonKeyDown}
      >
        {selected?.start}
        <span id={`${id}-val`} className="selector-value">
          {selected ? <Text option={selected} /> : <span className="selector-title selector-placeholder">{placeholder}</span>}
        </span>
        {selected?.end}
        <Chevron />
      </button>

      {isOpen && (
        <ul
          ref={list}
          id={`${id}-lista`}
          role="listbox"
          tabIndex={-1}
          className="selector-list"
          aria-labelledby={`${id}-etq`}
          aria-activedescendant={optionId(active)}
          onKeyDown={listKeyDown}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={o.value === value}
              className={cn("selector-option", i === active && "active", o.value === value && "selected", o.separated && "separated")}
              onPointerMove={() => i !== active && setActive(i)}
              onClick={() => choose(i)}
            >
              {o.start}
              <Text option={o} />
              {o.end}
              <Check />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
