/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Race control colors
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49',
                },
                // Severity colors
                severity: {
                    light: {
                        bg: '#fef3c7',
                        text: '#92400e',
                        border: '#f59e0b',
                    },
                    medium: {
                        bg: '#fed7aa',
                        text: '#c2410c',
                        border: '#f97316',
                    },
                    heavy: {
                        bg: '#fee2e2',
                        text: '#991b1b',
                        border: '#ef4444',
                    },
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}
