import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestNpmVersion, fetchLatestPypiVersion, fetchLatestVersion } from "../src/packageRegistry.js";
import { UNKNOWN } from "../../shared/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLatestNpmVersion", () => {
  it("returns the version from a successful npm registry response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ version: "0.9.2" }), { status: 200 }))));
    const result = await fetchLatestNpmVersion("ffmpeg-skill");
    expect(result.version).toBe("0.9.2");
    expect(result.error).toBeUndefined();
  });

  it("returns UNKNOWN with an error message on a 404 (package renamed/removed)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("not found", { status: 404 }))));
    const result = await fetchLatestNpmVersion("does-not-exist-skill");
    expect(result.version).toBe(UNKNOWN);
    expect(result.error).toContain("404");
  });

  it("returns UNKNOWN with an error message when fetch itself throws (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));
    const result = await fetchLatestNpmVersion("ffmpeg-skill");
    expect(result.version).toBe(UNKNOWN);
    expect(result.error).toContain("network down");
  });

  it("returns UNKNOWN when the response has no version field, rather than crashing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ name: "ffmpeg-skill" }), { status: 200 }))));
    const result = await fetchLatestNpmVersion("ffmpeg-skill");
    expect(result.version).toBe(UNKNOWN);
    expect(result.error).toBeTruthy();
  });
});

describe("fetchLatestPypiVersion", () => {
  it("returns the version from a successful PyPI response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ info: { version: "1.2.3" } }), { status: 200 }))));
    const result = await fetchLatestPypiVersion("some-package");
    expect(result.version).toBe("1.2.3");
  });

  it("returns UNKNOWN on a 404", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("not found", { status: 404 }))));
    const result = await fetchLatestPypiVersion("does-not-exist");
    expect(result.version).toBe(UNKNOWN);
    expect(result.error).toContain("404");
  });
});

describe("fetchLatestVersion", () => {
  it("dispatches to the npm lookup for kind 'npm'", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      expect(url).toContain("registry.npmjs.org");
      return Promise.resolve(new Response(JSON.stringify({ version: "1.0.0" }), { status: 200 }));
    }));
    const result = await fetchLatestVersion("npm", "ffmpeg-skill");
    expect(result.version).toBe("1.0.0");
  });

  it("dispatches to the PyPI lookup for kind 'pypi'", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      expect(url).toContain("pypi.org");
      return Promise.resolve(new Response(JSON.stringify({ info: { version: "2.0.0" } }), { status: 200 }));
    }));
    const result = await fetchLatestVersion("pypi", "some-package");
    expect(result.version).toBe("2.0.0");
  });
});

describe("fetchLatestNpmVersion (real network)", () => {
  it("resolves a real version for the real ffmpeg-skill npm package", async () => {
    const result = await fetchLatestNpmVersion("ffmpeg-skill");
    // Real, live assertion, not mocked: confirms this module actually works against the
    // real npm registry, not just against a fixture shaped like it. Matches this
    // project's own docs/DISTRIBUTION_MODEL.md finding of an npm/GitHub version drift
    // (npm 0.9.0 at the time that was written) -- assert only that SOME version comes
    // back, not a specific one, since npm's own state can change independently of this
    // repository.
    expect(typeof result.version).toBe("string");
    expect(result.version).not.toBe(UNKNOWN);
    expect(result.error).toBeUndefined();
  });
});
