import { defineConfig } from 'vitest/config'

// O Jest foi substituido pelo Vitest porque o Better Auth e toda a arvore de
// dependencias dele - better-call, jose, @noble/hashes - e publicada apenas em
// ESM. O Jest roda em CommonJS, e cada pacote acrescentado ao
// transformIgnorePatterns apenas empurrava o erro um nivel mais fundo. O Vitest
// e ESM nativo e carrega essas bibliotecas sem transformacao nenhuma.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    // Os testes de integracao compartilham o mesmo banco. Em paralelo, um
    // limparia dado que o outro ainda esta usando.
    fileParallelism: false,
    setupFiles: ['dotenv/config'],
  },
})
