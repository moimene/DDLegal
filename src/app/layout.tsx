import type { Metadata } from 'next';
import '@/styles/globals.css';
import AppShell from '@/components/layout/app-shell';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
    title: 'DD Legal PMO — Gestor de Due Diligence',
    description: 'Plataforma de gestión de Due Diligence Legal con agentes IA especializados por área.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body>
                <AppShell>
                    {children}
                </AppShell>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            fontFamily: 'var(--g-font-family)',
                            borderRadius: 'var(--g-radius-md)',
                        },
                    }}
                />
            </body>
        </html>
    );
}
