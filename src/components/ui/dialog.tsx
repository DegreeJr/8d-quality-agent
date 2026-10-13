'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
export function Dialog({ open, onOpenChange, title, description, children }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
}) { return <D.Root open={open} onOpenChange={onOpenChange}><D.Portal><D.Overlay className="dialog-overlay"/><D.Content className="dialog-content"><D.Title className="dialog-title">{title}</D.Title><D.Description className="muted">{description || 'Review and manage the selected quality record.'}</D.Description><D.Close className="dialog-close" aria-label="Close dialog"><X size={19}/></D.Close>{children}</D.Content></D.Portal></D.Root>; }
