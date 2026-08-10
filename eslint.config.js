export default [
    {
        files: [
            'extension.js',
            'examples/polkit/*.rules',
        ],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            'no-constant-condition': 'error',
            'no-trailing-spaces': 'error',
            'no-undef': 'off',
            'no-unused-vars': [
                'error',
                {
                    args: 'none',
                    caughtErrors: 'none',
                },
            ],
            'semi': ['error', 'always'],
        },
    },
];
