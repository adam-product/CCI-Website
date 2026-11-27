"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Option = string | { value: string; label: string; disabled?: boolean };

export function ChoiceField({
  label,
  options,
  value,
  defaultValue,
  name,
  required,
  disabled,
  onValueChange,
  compact,
}: {
  label: string;
  options: readonly Option[];
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      required={required}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        aria-label={label}
        className={compact ? "cci-choice cci-choice-compact" : "cci-choice"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        className="cci-choice-menu"
        position="popper"
        align="start"
      >
        {options.map((item) => {
          const option =
            typeof item === "string" ? { value: item, label: item } : item;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
