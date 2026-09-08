import { useState, useMemo } from 'react';

interface PasswordInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    icon?: string;
    showStrength?: boolean;
    autoComplete?: string;
    onBlur?: () => void;
}

interface StrengthResult {
    score: 0 | 1 | 2 | 3 | 4;
    label: string;
    color: string;
    bgBar: string;
    checks: { label: string; met: boolean }[];
}

function evaluateStrength(password: string): StrengthResult {
    const checks = [
        { label: 'Mínimo 6 caracteres', met: password.length >= 6 },
        { label: 'Letra minúscula', met: /[a-z]/.test(password) },
        { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
        { label: 'Número', met: /[0-9]/.test(password) },
        { label: 'Caractere especial', met: /[^A-Za-z0-9]/.test(password) },
    ];

    const met = checks.filter(c => c.met).length;

    if (password.length === 0) return { score: 0, label: '', color: '', bgBar: '', checks };
    if (met <= 2) return { score: 1, label: 'Fraca', color: 'text-red-500', bgBar: 'bg-red-500', checks };
    if (met <= 3) return { score: 2, label: 'Média', color: 'text-amber-500', bgBar: 'bg-amber-500', checks };
    if (met === 4) return { score: 3, label: 'Boa', color: 'text-emerald-500', bgBar: 'bg-emerald-500', checks };
    return { score: 4, label: 'Forte', color: 'text-emerald-600', bgBar: 'bg-emerald-600', checks };
}

const PasswordInput: React.FC<PasswordInputProps> = ({
    id,
    label,
    value,
    onChange,
    placeholder = '••••••••',
    required = true,
    icon = 'lock',
    showStrength = false,
    autoComplete,
    onBlur,
}) => {
    const [visible, setVisible] = useState(false);
    const strength = useMemo(() => showStrength ? evaluateStrength(value) : null, [value, showStrength]);

    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor={id}>
                {label}
            </label>
            <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </span>
                <input
                    className="block w-full pl-10 pr-12 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    id={id}
                    name={id}
                    placeholder={placeholder}
                    required={required}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    autoComplete={autoComplete}
                />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    <span className="material-symbols-outlined text-xl">
                        {visible ? 'visibility_off' : 'visibility'}
                    </span>
                </button>
            </div>

            {showStrength && strength && value.length > 0 && (
                <div className="mt-2.5 space-y-2">
                    {/* Strength bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex gap-1">
                            {[1, 2, 3, 4].map(level => (
                                <div
                                    key={level}
                                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                        level <= strength.score
                                            ? strength.bgBar
                                            : 'bg-slate-200 dark:bg-slate-700'
                                    }`}
                                />
                            ))}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-wider ${strength.color} min-w-[40px] text-right`}>
                            {strength.label}
                        </span>
                    </div>

                    {/* Criteria checklist */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {strength.checks.map((check, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                                    check.met
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-400'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm" style={{ fontSize: '14px' }}>
                                    {check.met ? 'check_circle' : 'circle'}
                                </span>
                                {check.label}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PasswordInput;
