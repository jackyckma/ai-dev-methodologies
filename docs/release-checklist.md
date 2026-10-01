# Release checklist

Maintainer steps for a framework release. Do not tag from a feature branch.

1. `node scripts/check-version.mjs` exits 0. It checks `VERSION` against `README.md`, `METHODOLOGIES.md`, the root `AGENTS.md`, `framework-manifest.json` `framework_version`, and the top `CHANGELOG.md` heading.
2. `node --test scripts/__tests__/` exits 0.
3. Merge the release pull request to `main`. Do not tag before that merge.
4. On the merge commit, regenerate the release baseline and commit it:

   ```bash
   node scripts/gen-baseline.mjs HEAD 1.9.0
   ```

   Use the version just released as `<id>`. The script hashes each `framework-manifest.json` `source` path as it existed at that commit and skips paths that did not exist yet. A dirty worktree is not included.
5. Tag `vX.Y.Z` on that commit and push the tag.
