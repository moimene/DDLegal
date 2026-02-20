import type { Metadata } from 'next';
import '@/styles/globals.css';
import Sidebar from '@/components/layout/sidebar';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
    title: 'DD Legal PMO — Gestor de Due Diligence',
    description: 'Plataforma de gestión de Due Diligence Legal con agentes IA especializados por área.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body>
                <div className="flex min-h-screen">
                    <Sidebar />
                    <div
                        className="flex-1 flex flex-col min-h-screen transition-all"
                        style={{ marginLeft: 'var(--sidebar-width)' }}
                    >
                        <main
                            className="flex-1"
                            style={{
                                padding: 'var(--g-space-8) var(--g-space-10) var(--g-space-12)',
                                maxWidth: 'var(--g-content-max-width)',
                                width: '100%',
                            }}
                        >
                            {children}
                        </main>
                    </div>
                </div>
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
