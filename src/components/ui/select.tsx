"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectOption = {
  label: string;
  value: string;
};

function SelectRoot(props: SelectPrimitive.Root.Props<string>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "ledger-field inline-flex items-center justify-between gap-2 px-3 text-xs text-zinc-200 outline-none",
        "hover:border-zinc-500/80 hover:bg-zinc-900/70",
        "focus-visible:border-sky-500/60 focus-visible:ring-2 focus-visible:ring-sky-500/20",
        "data-popup-open:border-sky-500/45 data-popup-open:ring-2 data-popup-open:ring-sky-500/15",
        "data-placeholder:text-zinc-600",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 text-zinc-600 transition-transform duration-200 [[data-popup-open]_&]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 6,
}: {
  className?: string;
  children: React.ReactNode;
  side?: SelectPrimitive.Positioner.Props["side"];
  align?: SelectPrimitive.Positioner.Props["align"];
  sideOffset?: number;
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="z-[200]">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "ledger-menu min-w-[var(--anchor-width)] p-1 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-open:slide-in-from-top-1.5",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-closed:slide-out-to-top-1",
            className,
          )}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2.5 py-1.5 pr-8 font-mono text-xs outline-none transition-colors duration-100",
        "data-highlighted:bg-sky-950/25 data-highlighted:text-sky-300",
        "data-selected:font-medium",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-sky-400" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function AppSelect({
  name,
  value,
  defaultValue,
  placeholder,
  options,
  onValueChange,
  triggerClassName,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options: SelectOption[];
  onValueChange?: (value: string) => void;
  triggerClassName?: string;
}) {
  const resolvedPlaceholder = placeholder ?? options[0]?.label ?? "Select";
  const controlled = value !== undefined;
  const selectKey = controlled ? "controlled" : `default:${defaultValue ?? ""}`;

  return (
    <SelectRoot
      key={selectKey}
      name={name}
      items={options}
      {...(controlled ? { value } : { defaultValue })}
      onValueChange={(next) => onValueChange?.(next ?? "")}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={resolvedPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value || "__empty__"} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

export {
  AppSelect,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
};
