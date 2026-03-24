'use client';

import Image from 'next/image';

import { cn } from '@/components/primary/utils';
import appTile from '@/assets/app-tile-trans-dark.png';
import iconTile from '@/assets/icon.png';

type FlowForgeLogoProps = {
  compact?: boolean;
  className?: string;
};

export function FlowForgeLogo({ compact = false, className }: FlowForgeLogoProps) {
  return (
    <div className={cn('inline-flex items-center', className)} aria-label="FlowForge">
      {compact ? (
        <Image src={iconTile} alt="FlowForge" priority className="h-10 w-auto" />
      ) : (
        <Image src={appTile} alt="FlowForge" priority className="h-18 w-auto" />
      )}
    </div>
  );
}
