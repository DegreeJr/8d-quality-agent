import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/app-provider';
import { AppShell } from '@/components/app-shell';
export const metadata: Metadata = { title: '8D Quality Agent | Manufacturing Quality', description: 'Human-led, AI-assisted manufacturing quality operations. Interactive synthetic demo.' };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body><AppProvider><AppShell>{children}</AppShell></AppProvider></body></html>; }
