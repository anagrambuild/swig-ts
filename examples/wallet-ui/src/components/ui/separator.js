import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '@/lib/utils';
const Separator = React.forwardRef(({ className, orientation = 'horizontal', ...props }, ref) => (_jsx("div", { ref: ref, "aria-orientation": orientation, className: cn('shrink-0 bg-border/70', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className), ...props })));
Separator.displayName = 'Separator';
export { Separator };
