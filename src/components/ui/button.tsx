import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "ledger-stamp group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-mono text-xs font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-sky-400/60 focus-visible:ring-2 focus-visible:ring-sky-400/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-rose-500 aria-invalid:ring-2 aria-invalid:ring-rose-500/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-sky-900/60 bg-sky-950/25 text-sky-300 [a]:hover:border-sky-700 hover:border-sky-700 hover:bg-sky-950/35 hover:text-sky-200",
        outline:
          "border-zinc-700/70 bg-zinc-950/55 text-zinc-300 hover:border-zinc-500/80 hover:bg-zinc-900/70 hover:text-zinc-100 aria-expanded:border-zinc-500/80 aria-expanded:bg-zinc-900/70 aria-expanded:text-zinc-100",
        secondary:
          "border-zinc-700/70 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800 aria-expanded:bg-zinc-800 aria-expanded:text-zinc-100",
        ghost:
          "text-zinc-500 hover:bg-zinc-900/55 hover:text-zinc-100 aria-expanded:bg-zinc-900/55 aria-expanded:text-zinc-100",
        destructive:
          "border-rose-900/50 bg-rose-950/25 text-rose-400 hover:border-rose-800 hover:bg-rose-950/35 focus-visible:border-rose-500/60 focus-visible:ring-rose-500/25",
        link: "text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 in-data-[slot=button-group]:rounded-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
