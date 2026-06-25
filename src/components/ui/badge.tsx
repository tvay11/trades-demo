import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "ledger-stamp group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 py-0.5 font-mono text-[0.65rem] font-semibold whitespace-nowrap transition-colors focus-visible:border-sky-400/60 focus-visible:ring-2 focus-visible:ring-sky-400/25 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-rose-500 aria-invalid:ring-rose-500/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-sky-900/50 bg-sky-950/25 text-sky-400 [a]:hover:bg-sky-950/35",
        secondary:
          "border-zinc-700/70 bg-zinc-950/55 text-zinc-300 [a]:hover:bg-zinc-900",
        destructive:
          "border-rose-900/50 bg-rose-950/25 text-rose-400 focus-visible:ring-rose-500/20 [a]:hover:bg-rose-950/35",
        outline:
          "border-zinc-700/70 text-zinc-300 [a]:hover:bg-zinc-900/60 [a]:hover:text-zinc-100",
        ghost:
          "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300",
        link: "text-sky-400 underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
