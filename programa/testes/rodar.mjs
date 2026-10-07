// rodar.mjs — o que `npm run teste` chama.
//
// Existe por um motivo só: apontar os testes pra um banco descartável.
//
// Antes eles importavam `src/ficha/banco.js` direto, que abre o banco de
// PRODUÇÃO. Com o robô no ar isso dava em duas coisas ruins ao mesmo tempo:
// fichas de teste (5519933332222) apareciam no banco real, e os dois processos
// brigavam pelo lock até a guarda confundir "ocupado" com "corrompido" e
// tentar mover o banco bom pra escanteio.
//
// Um arquivo separado, apagado antes e depois. Sem env var na mão, sem
// cross-env, e funciona igual no Windows e fora dele.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BANCO = 'dados/teste.db';

// Os alarmes também vão pra um canto descartável. A suíte corrompe um banco
// de propósito pra provar a guarda, e cada corrida gravava um "banco
// corrompido" no ALARME.log de verdade. Ninguém via, porque ninguém abre esse
// arquivo — até os alarmes irem pra tela do painel, e aparecerem 25 avisos
// graves que eram todos de mentira.
const ALARMES = 'dados/alarmes-de-teste.log';

const limpar = () => {
  for (const sufixo of ['', '-wal', '-shm']) {
    rmSync(resolve(RAIZ, BANCO + sufixo), { force: true });
  }
  rmSync(resolve(RAIZ, ALARMES), { force: true });
};

limpar();

const saida = spawnSync(process.execPath, ['--test'], {
  cwd: RAIZ,
  stdio: 'inherit',
  env: { ...process.env, RICARDO_BANCO: BANCO, RICARDO_ALARMES: ALARMES },
});

limpar();

process.exit(saida.status ?? 1);
