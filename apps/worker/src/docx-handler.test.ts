import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { PermanentJobError } from "@wechat-layout/job-runtime";
import { afterEach, describe, expect, it } from "vitest";

import { runPythonParser } from "./docx-handler.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "docx-handler-test-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Python DOCX worker boundary", () => {
  it("accepts the frozen Word/WPS intermediate envelope", async () => {
    const root = resolve(process.cwd(), "../..");
    const temporary = await temporaryDirectory();
    const sourcePath = join(temporary, "source.docx");
    await execFileAsync(
      "python3",
      [
        "-c",
        "from pathlib import Path; from docx_fixture import write_docx; write_docx(Path(__import__('sys').argv[1]), application='WPS Office')",
        sourcePath,
      ],
      { env: { ...process.env, PYTHONPATH: join(root, "services/docx-worker-python/tests") } },
    );

    const result = await runPythonParser({
      executable: "python3",
      pythonPath: join(root, "services/docx-worker-python/src"),
      sourcePath,
      extractDirectory: join(temporary, "images"),
      signal: undefined,
    });

    expect(result.detectedSource).toBe("wps");
    expect(result.sourceBlocks.map((block) => block.role)).toEqual([
      "title",
      "heading_1",
      "ordered_item",
      "ordered_item",
      "paragraph",
      "image_reference",
      "paragraph",
      "image_reference",
    ]);
    expect(result.resources.map((resource) => resource.resourceKey)).toEqual([
      "image_0001",
      "image_0002",
    ]);
    expect(result.tables).toHaveLength(1);
  });

  it("maps a malformed package to a permanent typed job error", async () => {
    const root = resolve(process.cwd(), "../..");
    const temporary = await temporaryDirectory();
    const sourcePath = join(temporary, "broken.docx");
    await writeFile(sourcePath, "not a zip");

    const error = await runPythonParser({
      executable: "python3",
      pythonPath: join(root, "services/docx-worker-python/src"),
      sourcePath,
      extractDirectory: join(temporary, "images"),
      signal: undefined,
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(PermanentJobError);
    expect(error.code).toBe("DOCX_INVALID_PACKAGE");
  });
});
