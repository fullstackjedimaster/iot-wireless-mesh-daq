/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            fontFamily: {
                orbitron: ["Orbitron", "system-ui", "sans-serif"]
            },
            fontSize: {
                'orbitron-xsm': ['clamp(0.65rem, 1.25vw, 0.8rem)', '1.2'],
                'orbitron-sm': ['clamp(0.875rem, 1.5vw, 1rem)', '1.2'],
                'orbitron-regular': ['clamp(1rem, 2vw, 1.25rem)', '1.2'],
                'orbitron-xl': ['clamp(1.5rem, 4vw, 2.5rem)', '1.2'],
                'orbitron-2xl': ['clamp(2rem, 6vw, 3rem)', '1.2']
            }
        }
    },
    plugins: []
}
