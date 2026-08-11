import test from "node:test";
import assert from "node:assert/strict";
import { EXPERIENCE_FILE_RULES, slugifyVillaName, validateExperienceFile } from "../src/features/experiences/utils/experienceFileValidation.js";

test("accepts all production gallery formats", () => {
  for (const type of EXPERIENCE_FILE_RULES.accept) {
    assert.equal(validateExperienceFile({ type, size: 1024 }), "");
  }
});

test("generates a safe storage slug from the villa name", () => {
  assert.equal(slugifyVillaName(" Villa Caimán - Tulum "), "villa-caiman-tulum");
});

test("rejects unsupported formats and files over 15 MB", () => {
  assert.match(validateExperienceFile({ type: "image/gif", size: 1024 }), /Formato/);
  assert.match(validateExperienceFile({ type: "image/webp", size: 15 * 1024 * 1024 + 1 }), /15 MB/);
});
