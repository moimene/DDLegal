'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Scale, LogIn, Loader2, AlertCircle, User,
    Shield, Briefcase, Gavel, Target, Users, Eye, UserCheck
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import type { ProjectRole } from '@/lib/supabase-auth';
import type { LucideIcon } from 'lucide-react';

/* ─── User definitions ─── */

interface DemoUser {
    email: string;
    password: string;
    role: ProjectRole;
    label: string;
    description: string;
    icon: LucideIcon;
    accent: string;  // CSS color for the role badge
}

const ADMIN_USER: DemoUser = {
    email: 'admin@ddlegal.com',
    password: 'admin123456',
    role: 'clo',
    label: 'Superusuario',
    description: 'Acceso total al sistema',
    icon: Shield,
    accent: 'var(--g-role-clo)',
};

const DEMO_USERS: DemoUser[] = [
    {
        email: 'clo@test.ddlegal.com',
        password: 'test123456',
        role: 'clo',
        label: 'CLO',
        description: 'Director Legal',
        icon: Scale,
        accent: 'var(--g-role-clo)',
    },
    {
        email: 'pm@test.ddlegal.com',
        password: 'test123456',
        role: 'pm_transaccion',
        label: 'PM',
        description: 'Project Manager',
        icon: Briefcase,
        accent: 'var(--g-role-pm)',
    },
    {
        email: 'abogado.merc@test.ddlegal.com',
        password: 'test123456',
        role: 'abogado_area',
        label: 'Abogado',
        description: 'Mercantil',
        icon: Gavel,
        accent: 'var(--g-role-abogado)',
    },
    {
        email: 'sponsor@test.ddlegal.com',
        password: 'test123456',
        role: 'deal_sponsor',
        label: 'Sponsor',
        description: 'Deal Sponsor',
        icon: Target,
        accent: 'var(--g-role-sponsor)',
    },
    {
        email: 'target@test.ddlegal.com',
        password: 'test123456',
        role: 'target_liaison',
        label: 'Target',
        description: 'Contacto Target',
        icon: UserCheck,
        accent: 'var(--g-role-target)',
    },
    {
        email: 'stakeholder@test.ddlegal.com',
        password: 'test123456',
        role: 'stakeholder_negocio',
        label: 'Stakeholder',
        description: 'Negocio',
        icon: Users,
        accent: 'var(--g-role-stakeholder)',
    },
    {
        email: 'cliente@test.ddlegal.com',
        password: 'test123456',
        role: 'cliente_externo',
        label: 'Cliente',
        description: 'Solo lectura',
        icon: Eye,
        accent: 'var(--g-role-cliente)',
    },
];

/* ─── Component ─── */

export default function LoginPage() {
    const router = useRouter();
    const { login } = useUser();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [phase, setPhase] = useState<'idle' | 'filling' | 'logging-in'>('idle');

    const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isDisabled = loading || phase !== 'idle';

    /* ─── Manual login ─── */
    async function handleManualLogin(e?: React.FormEvent) {
        e?.preventDefault();
        if (!email || !password) return;
        setError(null);
        setLoading(true);
        setPhase('logging-in');

        const success = await login(email, password);
        if (success) {
            router.push('/');
        } else {
            setError('Credenciales invalidas.');
            setPhase('idle');
        }
        setLoading(false);
    }

    /* ─── Select user → fill → auto-login ─── */
    const handleSelectUser = useCallback((user: DemoUser) => {
        if (isDisabled) return;

        // Clear any pending auto-login
        if (loginTimeoutRef.current) {
            clearTimeout(loginTimeoutRef.current);
        }

        setError(null);
        setSelectedUser(user.email);
        setPhase('filling');

        // Step 1: Fill email (instant)
        setEmail(user.email);
        setPassword('');

        // Step 2: Fill password after brief delay
        setTimeout(() => {
            setPassword(user.password);
        }, 200);

        // Step 3: Auto-login after credentials are visible
        loginTimeoutRef.current = setTimeout(async () => {
            setPhase('logging-in');
            setLoading(true);

            const success = await login(user.email, user.password);
            if (success) {
                router.push('/');
            } else {
                setError(`Error al iniciar sesion como ${user.label}.`);
                setPhase('idle');
                setSelectedUser(null);
                setLoading(false);
            }
        }, 600);
    }, [isDisabled, login, router]);

    /* ─── Deselect ─── */
    function handleDeselect() {
        if (phase === 'logging-in') return;
        if (loginTimeoutRef.current) {
            clearTimeout(loginTimeoutRef.current);
        }
        setSelectedUser(null);
        setEmail('');
        setPassword('');
        setPhase('idle');
    }

    return (
        <div style={styles.page}>
            {/* Subtle background pattern */}
            <div style={styles.bgPattern} />

            <div style={styles.container}>
                {/* ─── Left: Branding ─── */}
                <div style={styles.brandPanel}>
                    <div style={styles.brandContent}>
                        <div style={styles.logoMark}>
                            <Scale style={{ width: 28, height: 28, color: 'var(--g-text-inverse)' }} />
                        </div>
                        <h1 style={styles.brandTitle}>DD Legal PMO</h1>
                        <p style={styles.brandSubtitle}>
                            Plataforma de Due Diligence
                        </p>
                        <div style={styles.brandDivider} />
                        <p style={styles.brandCaption}>
                            Selecciona un perfil o introduce tus credenciales para acceder al sistema.
                        </p>
                    </div>
                    <p style={styles.brandFooter}>
                        Garrigues &middot; Entorno de demo
                    </p>
                </div>

                {/* ─── Right: Login panel ─── */}
                <div style={styles.loginPanel}>
                    {/* Error */}
                    {error && (
                        <div style={styles.errorBanner}>
                            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* ─── User grid ─── */}
                    <div style={styles.sectionLabel}>Acceso rapido</div>

                    {/* Admin card */}
                    <button
                        onClick={() => handleSelectUser(ADMIN_USER)}
                        disabled={isDisabled && selectedUser !== ADMIN_USER.email}
                        style={{
                            ...styles.adminCard,
                            ...(selectedUser === ADMIN_USER.email ? styles.adminCardSelected : {}),
                            opacity: isDisabled && selectedUser !== ADMIN_USER.email ? 0.4 : 1,
                            cursor: isDisabled ? 'default' : 'pointer',
                        }}
                    >
                        <div style={styles.adminIconWrap}>
                            {selectedUser === ADMIN_USER.email && phase !== 'idle' ? (
                                <Loader2 style={{ width: 18, height: 18, color: 'var(--g-text-inverse)', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Shield style={{ width: 18, height: 18, color: 'var(--g-text-inverse)' }} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.adminLabel}>Superusuario</div>
                            <div style={styles.adminDesc}>admin@ddlegal.com</div>
                        </div>
                        {selectedUser === ADMIN_USER.email && (
                            <div style={styles.selectedBadge}>
                                <div style={styles.selectedDot} />
                            </div>
                        )}
                    </button>

                    {/* Demo user grid */}
                    <div style={styles.userGrid}>
                        {DEMO_USERS.map((user) => {
                            const isSelected = selectedUser === user.email;
                            const Icon = user.icon;
                            return (
                                <button
                                    key={user.email}
                                    onClick={() => isSelected ? handleDeselect() : handleSelectUser(user)}
                                    disabled={isDisabled && !isSelected}
                                    style={{
                                        ...styles.userCard,
                                        ...(isSelected ? {
                                            borderColor: user.accent,
                                            boxShadow: `0 0 0 1px ${user.accent}, 0 2px 8px ${user.accent}22`,
                                            backgroundColor: `${user.accent}08`,
                                        } : {}),
                                        opacity: isDisabled && !isSelected ? 0.35 : 1,
                                        cursor: isDisabled && !isSelected ? 'default' : 'pointer',
                                    }}
                                >
                                    <div
                                        style={{
                                            ...styles.userIconWrap,
                                            backgroundColor: isSelected ? user.accent : 'var(--g-surface-muted, #f0f1f1)',
                                            color: isSelected ? '#fff' : 'var(--g-text-secondary, #5c6360)',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {isSelected && phase !== 'idle' ? (
                                            <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <Icon style={{ width: 14, height: 14 }} />
                                        )}
                                    </div>
                                    <div style={styles.userLabel}>{user.label}</div>
                                    <div style={styles.userDesc}>{user.description}</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* ─── Divider ─── */}
                    <div style={styles.divider}>
                        <div style={styles.dividerLine} />
                        <span style={styles.dividerText}>o con credenciales</span>
                        <div style={styles.dividerLine} />
                    </div>

                    {/* ─── Form ─── */}
                    <form onSubmit={handleManualLogin} style={styles.form}>
                        <div style={styles.inputGroup}>
                            <label htmlFor="email" style={styles.inputLabel}>Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); if (selectedUser) handleDeselect(); }}
                                placeholder="tu@email.com"
                                disabled={phase === 'logging-in'}
                                required
                                style={{
                                    ...styles.input,
                                    ...(selectedUser ? styles.inputFilled : {}),
                                }}
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label htmlFor="password" style={styles.inputLabel}>Contrasena</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); if (selectedUser) handleDeselect(); }}
                                placeholder="••••••••"
                                disabled={phase === 'logging-in'}
                                required
                                style={{
                                    ...styles.input,
                                    ...(selectedUser && password ? styles.inputFilled : {}),
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isDisabled || !email || !password}
                            style={{
                                ...styles.loginButton,
                                opacity: (isDisabled || !email || !password) ? 0.5 : 1,
                                cursor: (isDisabled || !email || !password) ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? (
                                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <LogIn style={{ width: 16, height: 16 }} />
                            )}
                            {phase === 'logging-in' ? 'Iniciando sesion...' : 'Iniciar sesion'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Hover states — not possible with inline styles alone */
                .dd-user-card:hover:not(:disabled) {
                    border-color: var(--g-border-default, #d4d8d6) !important;
                    background-color: var(--g-surface-hover, #f8faf9) !important;
                }
                .dd-admin-card:hover:not(:disabled) {
                    opacity: 0.92 !important;
                }
            `}</style>
        </div>
    );
}

/* ─── Styles ─── */

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--g-surface-page, #f4f5f5)',
        padding: 24,
        position: 'relative',
        fontFamily: 'var(--g-font-family)',
    },
    bgPattern: {
        position: 'fixed',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,68,56,0.04) 1px, transparent 0)`,
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
    },
    container: {
        display: 'flex',
        width: '100%',
        maxWidth: 880,
        minHeight: 540,
        backgroundColor: 'var(--g-surface-card, #ffffff)',
        borderRadius: 'var(--g-radius-xl, 16px)',
        boxShadow: 'var(--g-shadow-modal)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
    },
    /* ── Brand panel ── */
    brandPanel: {
        width: 280,
        flexShrink: 0,
        background: 'var(--g-brand-gradient)',
        padding: '40px 32px 28px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    brandContent: {},
    logoMark: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'var(--g-brand-logo-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    brandTitle: {
        fontSize: '1.375rem',
        fontWeight: 700,
        color: 'var(--g-text-inverse)',
        margin: 0,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
    },
    brandSubtitle: {
        fontSize: '0.8125rem',
        color: 'var(--g-sidebar-placeholder)',
        margin: '6px 0 0',
        fontWeight: 400,
    },
    brandDivider: {
        width: 32,
        height: 2,
        backgroundColor: 'var(--g-sidebar-surface-selected)',
        margin: '24px 0',
        borderRadius: 1,
    },
    brandCaption: {
        fontSize: '0.75rem',
        color: 'var(--g-sidebar-text-faint)',
        margin: 0,
        lineHeight: 1.6,
    },
    brandFooter: {
        fontSize: '0.6875rem',
        color: 'var(--g-sidebar-text-ghost)',
        margin: 0,
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
    },
    /* ── Login panel ── */
    loginPanel: {
        flex: 1,
        padding: '32px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto',
    },
    errorBanner: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 'var(--g-radius-md, 8px)',
        backgroundColor: 'var(--g-error-surface)',
        border: '1px solid var(--g-error-border)',
        color: 'var(--g-error-text)',
        fontSize: '0.8125rem',
        animation: 'fadeInUp 0.25s ease',
    },
    sectionLabel: {
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: 'var(--g-text-muted, #8c9196)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        margin: 0,
    },
    /* ── Admin card ── */
    adminCard: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 16px',
        borderRadius: 'var(--g-radius-md, 8px)',
        border: '2px solid var(--g-brand-3308, #004438)',
        backgroundColor: 'var(--g-brand-3308, #004438)',
        textAlign: 'left' as const,
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
    },
    adminCardSelected: {
        boxShadow: '0 0 0 2px var(--g-brand-3308), 0 4px 12px var(--g-shadow-brand)',
    },
    adminIconWrap: {
        width: 36,
        height: 36,
        borderRadius: '50%',
        backgroundColor: 'var(--g-sidebar-surface-selected)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    adminLabel: {
        fontSize: 'var(--g-text-body)',
        fontWeight: 700,
        color: 'var(--g-text-inverse)',
        lineHeight: 1.2,
    },
    adminDesc: {
        fontSize: '0.6875rem',
        color: 'var(--g-sidebar-placeholder)',
        marginTop: 1,
    },
    selectedBadge: {
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: 'var(--g-sidebar-surface-selected)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    selectedDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: 'var(--g-text-inverse)',
    },
    /* ── User grid ── */
    userGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
    },
    userCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '14px 8px 12px',
        borderRadius: 'var(--g-radius-md, 8px)',
        border: '1px solid var(--g-border-subtle, #e5e8e6)',
        backgroundColor: 'var(--g-surface-card, #ffffff)',
        textAlign: 'center' as const,
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
    },
    userIconWrap: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    userLabel: {
        fontSize: '0.75rem',
        fontWeight: 700,
        color: 'var(--g-text-primary, #1a1a1a)',
        lineHeight: 1.2,
    },
    userDesc: {
        fontSize: '0.625rem',
        color: 'var(--g-text-muted, #8c9196)',
        lineHeight: 1.3,
    },
    /* ── Divider ── */
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '4px 0',
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'var(--g-border-subtle, #e5e8e6)',
    },
    dividerText: {
        fontSize: '0.6875rem',
        color: 'var(--g-text-muted, #8c9196)',
        whiteSpace: 'nowrap' as const,
    },
    /* ── Form ── */
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    inputLabel: {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--g-text-secondary, #5c6360)',
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: 'var(--g-radius-md, 8px)',
        border: '1px solid var(--g-border-default, #d4d8d6)',
        fontSize: '0.8125rem',
        color: 'var(--g-text-primary, #1a1a1a)',
        backgroundColor: 'var(--g-surface-card, #ffffff)',
        outline: 'none',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box' as const,
        fontFamily: 'inherit',
    },
    inputFilled: {
        borderColor: 'var(--g-brand-bright, #009a77)',
        backgroundColor: 'var(--g-surface-subtle, #e8f4f0)',
    },
    loginButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        padding: '10px 16px',
        borderRadius: 'var(--g-radius-md, 8px)',
        border: 'none',
        backgroundColor: 'var(--g-brand-3308, #004438)',
        color: 'var(--g-text-inverse)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        transition: 'opacity 0.15s',
        fontFamily: 'inherit',
    },
};
