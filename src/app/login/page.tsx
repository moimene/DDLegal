'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, LogIn, Loader2, AlertCircle, User } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { getRoleLabel } from '@/lib/supabase-auth';
import type { ProjectRole } from '@/lib/supabase-auth';

interface TestUserButton {
    email: string;
    role: ProjectRole;
    label: string;
    description: string;
}

const ADMIN_USER: TestUserButton = {
    email: 'admin@ddlegal.com',
    role: 'clo',
    label: 'Superusuario',
    description: 'Admin — Acceso total a todo el sistema',
};

const TEST_USERS: TestUserButton[] = [
    {
        email: 'clo@test.ddlegal.com',
        role: 'clo',
        label: 'CLO',
        description: 'Director Legal — Acceso total al proyecto',
    },
    {
        email: 'pm@test.ddlegal.com',
        role: 'pm_transaccion',
        label: 'PM Transaccion',
        description: 'Project Manager — Gestiona tareas y equipo',
    },
    {
        email: 'abogado.merc@test.ddlegal.com',
        role: 'abogado_area',
        label: 'Abogado Area',
        description: 'Abogado Mercantil — Trabaja en su area',
    },
    {
        email: 'sponsor@test.ddlegal.com',
        role: 'deal_sponsor',
        label: 'Deal Sponsor',
        description: 'Sponsor — Vista estrategica del deal',
    },
    {
        email: 'target@test.ddlegal.com',
        role: 'target_liaison',
        label: 'Contacto Target',
        description: 'Contacto del target — Responde Q&A',
    },
    {
        email: 'stakeholder@test.ddlegal.com',
        role: 'stakeholder_negocio',
        label: 'Stakeholder',
        description: 'Stakeholder Negocio — Ve informes y war room',
    },
    {
        email: 'cliente@test.ddlegal.com',
        role: 'cliente_externo',
        label: 'Cliente',
        description: 'Cliente Externo — Solo lectura de progreso',
    },
];

const TEST_PASSWORD = 'test123456';
const ADMIN_PASSWORD = 'admin123456';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useUser();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingUser, setLoadingUser] = useState<string | null>(null);

    async function handleLogin(e?: React.FormEvent) {
        e?.preventDefault();
        setError(null);
        setLoading(true);

        const success = await login(email, password);

        if (success) {
            router.push('/');
        } else {
            setError('Credenciales invalidas. Verifica tu email y contrasena.');
        }

        setLoading(false);
    }

    async function handleTestUserLogin(testUser: TestUserButton, password?: string) {
        setError(null);
        setLoadingUser(testUser.email);
        const pwd = password || TEST_PASSWORD;
        setEmail(testUser.email);
        setPassword(pwd);

        const success = await login(testUser.email, pwd);

        if (success) {
            router.push('/');
        } else {
            setError(`No se pudo iniciar sesion como ${getRoleLabel(testUser.role)}. Ejecuta primero POST /api/auth/setup-test-users para crear los usuarios de prueba.`);
        }

        setLoadingUser(null);
    }

    const isFormDisabled = loading || !!loadingUser;

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--g-surface-subtle, #f8f9fa)',
                padding: 'var(--g-space-6)',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '480px',
                    backgroundColor: 'var(--g-surface-primary, #ffffff)',
                    borderRadius: 'var(--g-radius-lg, 12px)',
                    boxShadow: 'var(--g-shadow-lg, 0 8px 30px rgba(0,0,0,0.12))',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: 'var(--g-space-8) var(--g-space-8) var(--g-space-6)',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--g-border-subtle, #e5e7eb)',
                        background: 'linear-gradient(135deg, var(--g-brand-3308, #1a1a2e) 0%, var(--g-sec-700, #2d2d44) 100%)',
                    }}
                >
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '56px',
                            height: '56px',
                            borderRadius: 'var(--g-radius-lg, 12px)',
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            marginBottom: 'var(--g-space-4)',
                        }}
                    >
                        <Scale style={{ width: '28px', height: '28px', color: 'var(--g-brand-bright, #60a5fa)' }} />
                    </div>
                    <h1
                        style={{
                            fontSize: 'var(--g-text-h2, 1.5rem)',
                            fontWeight: 700,
                            color: 'var(--g-text-inverse, #ffffff)',
                            margin: 0,
                        }}
                    >
                        DD Legal PMO
                    </h1>
                    <p
                        style={{
                            fontSize: 'var(--g-text-body, 0.875rem)',
                            color: 'rgba(255,255,255,0.7)',
                            marginTop: 'var(--g-space-1)',
                        }}
                    >
                        Acceso al sistema
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleLogin}
                    style={{
                        padding: 'var(--g-space-6) var(--g-space-8)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--g-space-4)',
                    }}
                >
                    {/* Error message */}
                    {error && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--g-space-3)',
                                padding: 'var(--g-space-3) var(--g-space-4)',
                                borderRadius: 'var(--g-radius-md, 8px)',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#b91c1c',
                                fontSize: 'var(--g-text-small, 0.8125rem)',
                            }}
                        >
                            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label
                            htmlFor="email"
                            style={{
                                display: 'block',
                                fontSize: 'var(--g-text-small, 0.8125rem)',
                                fontWeight: 600,
                                color: 'var(--g-text-primary, #1a1a2e)',
                                marginBottom: 'var(--g-space-1)',
                            }}
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            disabled={isFormDisabled}
                            required
                            style={{
                                width: '100%',
                                padding: 'var(--g-space-2) var(--g-space-3)',
                                borderRadius: 'var(--g-radius-md, 8px)',
                                border: '1px solid var(--g-border-default, #d1d5db)',
                                fontSize: 'var(--g-text-body, 0.875rem)',
                                color: 'var(--g-text-primary, #1a1a2e)',
                                backgroundColor: 'var(--g-surface-primary, #ffffff)',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--g-brand-3308, #1a1a2e)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--g-border-default, #d1d5db)'; }}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="password"
                            style={{
                                display: 'block',
                                fontSize: 'var(--g-text-small, 0.8125rem)',
                                fontWeight: 600,
                                color: 'var(--g-text-primary, #1a1a2e)',
                                marginBottom: 'var(--g-space-1)',
                            }}
                        >
                            Contrasena
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Tu contrasena"
                            disabled={isFormDisabled}
                            required
                            style={{
                                width: '100%',
                                padding: 'var(--g-space-2) var(--g-space-3)',
                                borderRadius: 'var(--g-radius-md, 8px)',
                                border: '1px solid var(--g-border-default, #d1d5db)',
                                fontSize: 'var(--g-text-body, 0.875rem)',
                                color: 'var(--g-text-primary, #1a1a2e)',
                                backgroundColor: 'var(--g-surface-primary, #ffffff)',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--g-brand-3308, #1a1a2e)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--g-border-default, #d1d5db)'; }}
                        />
                    </div>

                    {/* Login button */}
                    <button
                        type="submit"
                        disabled={isFormDisabled}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--g-space-2)',
                            width: '100%',
                            padding: 'var(--g-space-3)',
                            borderRadius: 'var(--g-radius-md, 8px)',
                            border: 'none',
                            backgroundColor: 'var(--g-brand-3308, #1a1a2e)',
                            color: 'var(--g-text-inverse, #ffffff)',
                            fontSize: 'var(--g-text-body, 0.875rem)',
                            fontWeight: 600,
                            cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                            opacity: isFormDisabled ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                        }}
                    >
                        {loading ? (
                            <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <LogIn style={{ width: '18px', height: '18px' }} />
                        )}
                        Iniciar sesion
                    </button>
                </form>

                {/* Admin superuser button */}
                <div style={{ padding: 'var(--g-space-2) var(--g-space-8) 0' }}>
                    <button
                        onClick={() => handleTestUserLogin(ADMIN_USER, ADMIN_PASSWORD)}
                        disabled={isFormDisabled}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--g-space-3)',
                            width: '100%',
                            padding: 'var(--g-space-3) var(--g-space-4)',
                            borderRadius: 'var(--g-radius-md, 8px)',
                            border: '2px solid var(--g-brand-3308, #1a1a2e)',
                            backgroundColor: 'var(--g-brand-3308, #1a1a2e)',
                            cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                            opacity: isFormDisabled ? 0.5 : 1,
                            transition: 'all 0.15s',
                            textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                            if (!isFormDisabled) {
                                e.currentTarget.style.opacity = '0.9';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = isFormDisabled ? '0.5' : '1';
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: 'var(--g-radius-full, 50%)',
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                flexShrink: 0,
                            }}
                        >
                            {loadingUser === ADMIN_USER.email ? (
                                <Loader2 style={{ width: '16px', height: '16px', color: '#fff', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Scale style={{ width: '16px', height: '16px', color: 'var(--g-brand-bright, #60a5fa)' }} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 'var(--g-text-body, 0.875rem)', fontWeight: 700, color: '#fff', margin: 0, lineHeight: '1.2' }}>
                                {ADMIN_USER.label}
                            </p>
                            <p style={{ fontSize: 'var(--g-text-caption, 0.75rem)', color: 'rgba(255,255,255,0.7)', margin: 0, marginTop: '2px', lineHeight: '1.3' }}>
                                {ADMIN_USER.description}
                            </p>
                        </div>
                    </button>
                </div>

                {/* Divider */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-3)',
                        padding: 'var(--g-space-4) var(--g-space-8) 0',
                    }}
                >
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--g-border-subtle, #e5e7eb)' }} />
                    <span
                        style={{
                            fontSize: 'var(--g-text-caption, 0.75rem)',
                            color: 'var(--g-text-muted, #9ca3af)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        O accede como usuario de prueba
                    </span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--g-border-subtle, #e5e7eb)' }} />
                </div>

                {/* Test user buttons */}
                <div
                    style={{
                        padding: 'var(--g-space-4) var(--g-space-8) var(--g-space-8)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--g-space-2)',
                    }}
                >
                    {TEST_USERS.map((testUser) => {
                        const isLoading = loadingUser === testUser.email;
                        return (
                            <button
                                key={testUser.email}
                                onClick={() => handleTestUserLogin(testUser)}
                                disabled={isFormDisabled}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--g-space-3)',
                                    width: '100%',
                                    padding: 'var(--g-space-3) var(--g-space-4)',
                                    borderRadius: 'var(--g-radius-md, 8px)',
                                    border: '1px solid var(--g-border-subtle, #e5e7eb)',
                                    backgroundColor: isLoading
                                        ? 'var(--g-surface-subtle, #f8f9fa)'
                                        : 'var(--g-surface-primary, #ffffff)',
                                    cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                                    opacity: isFormDisabled && !isLoading ? 0.5 : 1,
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isFormDisabled) {
                                        e.currentTarget.style.backgroundColor = 'var(--g-surface-hover, #f3f4f6)';
                                        e.currentTarget.style.borderColor = 'var(--g-brand-3308, #1a1a2e)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = isLoading
                                        ? 'var(--g-surface-subtle, #f8f9fa)'
                                        : 'var(--g-surface-primary, #ffffff)';
                                    e.currentTarget.style.borderColor = 'var(--g-border-subtle, #e5e7eb)';
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: 'var(--g-radius-full, 50%)',
                                        backgroundColor: 'var(--g-surface-subtle, #f8f9fa)',
                                        flexShrink: 0,
                                    }}
                                >
                                    {isLoading ? (
                                        <Loader2
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                color: 'var(--g-brand-3308, #1a1a2e)',
                                                animation: 'spin 1s linear infinite',
                                            }}
                                        />
                                    ) : (
                                        <User
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                color: 'var(--g-text-secondary, #6b7280)',
                                            }}
                                        />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p
                                        style={{
                                            fontSize: 'var(--g-text-body, 0.875rem)',
                                            fontWeight: 600,
                                            color: 'var(--g-text-primary, #1a1a2e)',
                                            margin: 0,
                                            lineHeight: '1.2',
                                        }}
                                    >
                                        {testUser.label}
                                    </p>
                                    <p
                                        style={{
                                            fontSize: 'var(--g-text-caption, 0.75rem)',
                                            color: 'var(--g-text-muted, #9ca3af)',
                                            margin: 0,
                                            marginTop: '2px',
                                            lineHeight: '1.3',
                                        }}
                                    >
                                        {testUser.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Spin keyframes */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
