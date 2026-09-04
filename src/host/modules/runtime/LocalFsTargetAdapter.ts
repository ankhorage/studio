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

/***
 * Emit opt-in filesystem trace output for local module target operations.
 * @todo Move this adapter-local tracing with the FileTargetAdapter implementation to the Orchestrator owner.
 */
function trace(op: string, p: string) {
  if (process.env.ANKH_TRACE_FS) {
    const [, time] = new Date().toISOString().split('T');
    console.log(`[FS-TRACE][${time}] ${op.padEnd(10)}: ${p}`);
  }
}

/***
 * Implement the Orchestrator module target filesystem contract with local Node filesystem/process APIs.
 * @todo Move this concrete FileTargetAdapter out of Studio to the Orchestrator/runtime owner instead of retaining a package-generic adapter under Studio host modules.
 */
export class LocalFsTargetAdapter implements FileTargetAdapter {
  /*** Report whether a local target path exists. */
  async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  /*** Read UTF-8 text from a local target path, returning null when unavailable. */
  async readText(p: string): Promise<string | null> {
    try {
      return await fs.readFile(p, 'utf8');
    } catch {
      return null;
    }
  }

  /*** Write UTF-8 text after ensuring the destination directory exists. */
  async writeText(p: string, content: string): Promise<void> {
    trace('writeText', p);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, 'utf8');
  }

  /*** Read one directory's entry names, returning an empty list when unavailable. */
  async readDir(absDir: string): Promise<string[]> {
    try {
      return await fs.readdir(absDir);
    } catch {
      return [];
    }
  }

  /*** Ensure a target directory exists recursively. */
  async ensureDir(p: string): Promise<void> {
    trace('ensureDir', p);
    await fs.mkdir(p, { recursive: true });
  }

  /*** Remove a local target path recursively while tolerating already-absent paths. */
  async remove(p: string): Promise<void> {
    trace('remove', p);
    try {
      await fs.rm(p, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  /*** Move a local target path after ensuring the destination parent exists. */
  async move(fromPath: string, toPath: string): Promise<void> {
    trace('move', `${fromPath} -> ${toPath}`);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath);
  }

  /*** Read and parse a JSON file through the target adapter's text semantics. */
  async readJson<T>(p: string): Promise<T | null> {
    const txt = await this.readText(p);
    if (!txt) return null;
    return JSON.parse(txt) as T;
  }

  /*** Serialize a value as normalized pretty JSON and write it through the target adapter. */
  async writeJson(p: string, value: unknown): Promise<void> {
    // trace handled by writeText
    const content = JSON.stringify(value, null, 2).replace(/\r\n/g, '\n') + '\n';
    await this.writeText(p, content);
  }

  /*** Execute one local command in the target working directory and normalize success/failure output. */
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
