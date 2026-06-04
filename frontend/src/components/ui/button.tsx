import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** shadcn Button aligned to DOCYAN tokens. The kit's own `.btn`/`.primary-btn`
 *  classes are used for pixel-faithful surfaces; this is the generic primitive. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cinnabar-50 focus-visible:border-cinnabar-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-cinnabar-500 text-white hover:bg-cinnabar-600 hover:shadow-cinnabar",
        secondary: "bg-surface text-fg border border-border-strong hover:bg-amate-100",
        ghost: "bg-transparent text-fg hover:bg-amate-100",
        outline: "border border-border-strong bg-surface text-fg hover:bg-amate-100",
        destructive: "bg-danger-600 text-white hover:opacity-90",
        link: "text-accent-fg underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-[13px]",
        lg: "h-12 rounded-md px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
