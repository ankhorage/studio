import { execFile as execFileCb } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFileCb);

interface FileTargetAdapter {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
  ensureDir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(fromPath: string, toPath: string): Promise<void>;
  readJson<T>(path: string): Promise<T | null>;
  writeJson(path: string, value: unknown): Promise<void>;
  exec?(
    cwd: string,
    command: string,
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }>;
}

function trace(op: string, p: string) {
  if (process.env.ANKH_TRACE_FS) {
    const [, time] = new Date().toISOString().split('T');
    console.log(`[FS-TRACE][${time}] ${op.padEnd(10)}: ${p}`);
  }
}

export class LocalFsTargetAdapter implements FileTargetAdapter {
  async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async readText(p: string): Promise<string | null> {
    try {
      return await fs.readFile(p, 'utf8');
    } catch {
      return null;
    }
  }

  async writeText(p: string, content: string): Promise<void> {
    trace('writeText', p);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, 'utf8');
  }

  async readDir(absDir: string): Promise<string[]> {
    try {
      return await fs.readdir(absDir);
    } catch {
      return [];
    }
  }

  async ensureDir(p: string): Promise<void> {
    trace('ensureDir', p);
    await fs.mkdir(p, { recursive: true });
  }

  async remove(p: string): Promise<void> {
    trace('remove', p);
    try {
      await fs.rm(p, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    trace('move', `${fromPath} -> ${toPath}`);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath);
  }

  async readJson<T>(p: string): Promise<T | null> {
    const txt = await this.readText(p);
    if (!txt) return null;
    return JSON.parse(txt) as T;
  }

  async writeJson(p: string, value: unknown): Promise<void> {
    // trace handled by writeText
    const content = JSON.stringify(value, null, 2).replace(/\r\n/g, '\n') + '\n';
    await this.writeText(p, content);
  }

  async exec(cwd: string, command: string, args: string[]) {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { cwd });
      return { code: 0, stdout, stderr };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { code: 1, stdout: '', stderr: err.message };
      }
      return { code: 1, stdout: '', stderr: 'Unknown exec error' };
    }
  }
}
