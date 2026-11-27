import { Button } from '@heroui/react';
import type { ComponentPropsWithoutRef } from 'react';
import { HapticTap } from '@/components/haptic-tap';
import { cn } from '@/lib/utils';

type Props = ComponentPropsWithoutRef<typeof Button> & {
    containerClassName?: string;
    haptic?: boolean;
};

export function HapticButton({
    containerClassName,
    haptic = true,
    isDisabled,
    isPending,
    ...props
}: Props) {
    return (
        <HapticTap<HTMLButtonElement>
            className={cn('grid', containerClassName)}
            enabled={haptic && !isDisabled && !isPending}
        >
            {(ref) => (
                <Button
                    fullWidth
                    {...props}
                    ref={ref}
                    isDisabled={isDisabled}
                    isPending={isPending}
                />
            )}
        </HapticTap>
    );
}
