// Carregado antes de cada arquivo de teste de integração: usa o banco ridersync_test.
import path from 'node:path';

process.loadEnvFile(path.resolve(__dirname, '../.env.test'));
