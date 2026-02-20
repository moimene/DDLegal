import type { Metadata } from 'next';
import '@/styles/globals.css';
import Sidebar from '@/components/layout/sidebar';

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
                    <main
                        className="flex-1 transition-all"
                        style={{ marginLeft: 'var(--sidebar-width)', padding: 'var(--g-space-8)' }}
                    >
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}
