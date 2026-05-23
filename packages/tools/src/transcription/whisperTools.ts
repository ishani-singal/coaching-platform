import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Transcribes a local audio/video file using open-source Whisper via Python subprocess.
 * Requires: pip install openai-whisper
 * Set WHISPER_PYTHON_ENV to the Python executable path (default: python3).
 * Set WHISPER_MODEL to the model size (default: small).
 */
/**
 * Resolves the Python executable: honours WHISPER_PYTHON_ENV, then tries
 * 'python3' (Linux/macOS), then falls back to 'python' (Windows).
 */
async function resolvePython(): Promise<string> {
  if (process.env.WHISPER_PYTHON_ENV) return process.env.WHISPER_PYTHON_ENV;
  for (const candidate of ['python3', 'python']) {
    const ok = await new Promise<boolean>(resolve => {
      const p = spawn(candidate, ['--version'], { stdio: 'ignore' });
      p.on('close', code => resolve(code === 0));
      p.on('error', () => resolve(false));
    });
    if (ok) return candidate;
  }
  throw new Error('No Python executable found. Install Python and/or set WHISPER_PYTHON_ENV.');
}

export async function transcribeFile(
  filePath: string,
  language = 'en'
): Promise<string> {
  const python = await resolvePython();
  const model  = process.env.WHISPER_MODEL ?? 'small';
  const outDir = os.tmpdir();
  const baseName = path.basename(filePath, path.extname(filePath));
  const outputFile = path.join(outDir, `${baseName}.txt`);

  // Remove any leftover output file first
  await fs.unlink(outputFile).catch(() => {});

  await runWhisper(python, [
    '-m', 'whisper',
    filePath,
    '--model', model,
    '--language', language,
    '--output_format', 'txt',
    '--output_dir', outDir,
    '--verbose', 'False',
  ]);

  const transcript = await fs.readFile(outputFile, 'utf-8');
  await fs.unlink(outputFile).catch(() => {});
  return transcript.trim();
}

/**
 * Downloads audio-only stream from a YouTube URL using yt-dlp,
 * saves to a temp file, then transcribes with Whisper.
 * Requires yt-dlp in PATH or set YTDLP_PATH.
 */
export async function transcribeYoutubeAudio(
  videoUrl: string,
  language = 'en'
): Promise<string> {
  const ytdlp = process.env.YTDLP_PATH ?? 'yt-dlp';
  const tmpDir  = os.tmpdir();
  const tmpFile = path.join(tmpDir, `yt_audio_${Date.now()}.%(ext)s`);

  await runProcess(ytdlp, [
    videoUrl,
    '--format', 'bestaudio[ext=m4a]/bestaudio',
    '--output', tmpFile,
    '--no-playlist',
    '--quiet',
  ]);

  // Find the downloaded file (extension may vary)
  const files = await fs.readdir(tmpDir);
  const prefix = path.basename(tmpFile).replace('%(ext)s', '');
  const audioFile = files
    .filter(f => f.startsWith(prefix.replace(/\\/g, '/')))
    .map(f => path.join(tmpDir, f))[0];

  if (!audioFile) throw new Error('yt-dlp did not produce an output file');

  try {
    return await transcribeFile(audioFile, language);
  } finally {
    await fs.unlink(audioFile).catch(() => {});
  }
}

function runWhisper(executable: string, args: string[]): Promise<void> {
  return runProcess(executable, args);
}

function runProcess(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stderr: string[] = [];
    proc.stderr?.on('data', (d: Buffer) => stderr.push(d.toString()));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${executable} exited with code ${code}: ${stderr.join('')}`));
    });
    proc.on('error', reject);
  });
}
