// Entry point específico do Vitest: augmenta a interface `Assertion` do Vitest com
// os matchers do jest-dom (toBeInTheDocument, toHaveAttribute, ...). O import genérico
// '@testing-library/jest-dom' não tipa corretamente contra o Vitest (some no tsc a
// partir do Vitest 3/4, que mudou o shape de Assertion). Válido já no Vitest 2.
import '@testing-library/jest-dom/vitest';
