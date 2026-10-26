import { useState } from "react";

import type { TicketPriority } from "../../api/types";
import { MAX_LENGTH, OTHER_CATEGORY, PRIORITIES, PRIORITY_LABELS } from "../../lib/labels";

interface CategoryPickerProps {
  /** Catégories du projet. */
  categories: string[];
  value: string;
  onChange: (category: string) => void;
}

/** Catégories du projet en un clic, ou saisie libre via "Autre". */
export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const suggested = categories.filter((category) => category !== OTHER_CATEGORY);
  const [otherMode, setOtherMode] = useState(value !== "" && !suggested.includes(value));
  const [otherText, setOtherText] = useState(otherMode && value !== OTHER_CATEGORY ? value : "");

  const chooseOther = () => {
    setOtherMode(true);
    onChange(otherText.trim() || OTHER_CATEGORY);
  };

  return (
    <div className="category-picker">
      <div className="chips">
        {suggested.map((category) => (
          <button
            key={category}
            type="button"
            className="chip"
            aria-pressed={!otherMode && value === category}
            onClick={() => {
              setOtherMode(false);
              onChange(category);
            }}
          >
            {category}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={otherMode} onClick={chooseOther}>
          {OTHER_CATEGORY}…
        </button>
      </div>
      {otherMode && (
        <input
          className="input"
          aria-label="Préciser la catégorie"
          placeholder="Précisez (facultatif)"
          maxLength={MAX_LENGTH.category}
          autoFocus
          value={otherText}
          onChange={(event) => {
            setOtherText(event.target.value);
            onChange(event.target.value.trim() || OTHER_CATEGORY);
          }}
        />
      )}
    </div>
  );
}

interface PriorityPickerProps {
  value: TicketPriority;
  onChange: (priority: TicketPriority) => void;
  name?: string;
}

export function PriorityPicker({ value, onChange, name = "priority" }: PriorityPickerProps) {
  return (
    <div className="segmented">
      {PRIORITIES.map((priority) => (
        <label key={priority} className={`segmented__option segmented__option--${priority}`}>
          <input
            type="radio"
            name={name}
            value={priority}
            checked={value === priority}
            onChange={() => onChange(priority)}
          />
          <span>{PRIORITY_LABELS[priority]}</span>
        </label>
      ))}
    </div>
  );
}
