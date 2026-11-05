import { afterEach, describe, expect, it } from "vitest";
import { getConfig, publicConfig } from "@/lib/research/config";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("mode detection", () => {
  it("is demo when either key is missing and never exposes values", () => {
    delete process.env.PARALLEL_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    expect(getConfig().mode).toBe("demo");
    expect(publicConfig().missing).toEqual(["PARALLEL_API_KEY", "ANTHROPIC_API_KEY"]);
    process.env.PARALLEL_API_KEY = "secret-p";
    expect(getConfig().mode).toBe("demo");
    expect(JSON.stringify(publicConfig())).not.toContain("secret-p");
  });
  it("is live when both keys are set", () => {
    process.env.PARALLEL_API_KEY = "a"; process.env.ANTHROPIC_API_KEY = "b";
    expect(getConfig().mode).toBe("live");
    expect(publicConfig().missing).toEqual([]);
  });
});
