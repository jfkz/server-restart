// Defer loading ssh2 to runtime to avoid bundler issues

export interface SSHOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  commands: string[] | string;
  timeoutMs?: number;
}

export interface SSHResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function runRemoteCommands({
  host,
  port = 22,
  username,
  password,
  privateKey,
  commands,
  timeoutMs = 120000,
}: SSHOptions): Promise<SSHResult> {
  console.log('Running SSH commands:', commands);
  const SSHClientCtor = (eval as unknown as (code: string) => any)('require')('ssh2').Client as any;
  console.log('SSHClientCtor:', SSHClientCtor);
  if (!host || !username || (!password && !privateKey)) {
    throw new Error('Missing SSH configuration: host, username, and password or privateKey are required');
  }

  const conn = new SSHClientCtor();

  const commandString = Array.isArray(commands)
    ? commands.filter(Boolean).join(' && ')
    : String(commands || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join(' && ');

  if (!commandString) {
    throw new Error('No command(s) provided to execute');
  }

  const config: {
    host: string;
    port: number;
    username: string;
    readyTimeout: number;
    privateKey?: string | Buffer;
    password?: string;
  } = {
    host,
    port,
    username,
    readyTimeout: timeoutMs,
  };

  if (privateKey) config.privateKey = privateKey;
  if (password) config.password = password;

  return new Promise<SSHResult>((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    conn
      .on('ready', () => {
        console.log('SSH connection ready');
        conn.exec(commandString, { pty: true }, (err: Error | undefined, stream: any) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(err);
          }

          let stdout = '';
          let stderr = '';
          let exitCode: number | null = null;

          stream
            .on('close', () => {
              clearTimeout(timer);
              conn.end();
              resolve({ stdout, stderr, exitCode });
            })
            .on('data', (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });

          stream.on('exit', (code: number) => {
            exitCode = code;
          });
        });
      })
      .on('error', (err: Error) => {
        console.log('SSH connection error:', err);
        clearTimeout(timer);
        reject(err);
      })
      .connect(config);

    timer = setTimeout(() => {
      try {
        conn.end();
      } catch {}
      reject(new Error('SSH command timed out'));
    }, timeoutMs);
  });
}