# Synclair foundation release

The foundation is distributed as a private, immutable package from
`cellfade/synclair`. A release binds one human-reviewed PR merge commit to a
classified manifest, deterministic archive, numeric GitHub repository identity,
tag record, and GitHub Actions provenance attestations.

## Release boundary

The first proposed tag is `foundation-v0.1.0`. Merging release tooling does not
publish that tag. Dispatching `publish-foundation-release` is a separate action
that requires explicit release approval and the confirmation text
`publish-foundation-release:<tag>:<source_commit>`.

Publication is currently blocked. GitHub's official action documentation says
private-repository artifact attestations require GitHub Enterprise Cloud, and
the user has not approved paid Actions or an Enterprise dependency. Keep the
workflow dormant until the entitlement is independently confirmed.

Before dispatch, record:

- the reviewed merge commit (a full 40-character SHA);
- repository ID `1308412422`;
- the exact release tag;
- the available GitHub Actions minutes and spending policy.
- GitHub Enterprise Cloud private artifact-attestation entitlement;
- a tag ruleset that prevents updates or deletion of `foundation-v*`;
- GitHub immutable releases enabled for the repository.

Do not dispatch until those provider prerequisites are read back and recorded.
Dispatch from `main` and supply the independently recorded source SHA. The
workflow fails unless `github.sha` equals that input, then packages the exact
commit, attests the envelope and archive, creates or safely resumes the tag at
that SHA, and publishes four private release assets.

Publication uses a draft release. A retry may resume only a draft tied to the
same approved tag and source SHA. Existing assets are accepted only when their
GitHub-reported SHA-256 digest matches the newly verified local asset; missing
assets are uploaded, mismatches fail closed, and the draft is published only
after all four assets match. An already-published release is never mutated.

```sh
gh workflow run publish-foundation-release.yml \
  --repo cellfade/synclair \
  --ref main \
  -f tag=foundation-v0.1.0 \
  -f source_commit=<40-character-reviewed-merge-sha> \
  -f enterprise_attestations=enterprise-private-attestations-enabled \
  -f confirmation=publish-foundation-release:foundation-v0.1.0:<40-character-reviewed-merge-sha>
```

This release approval does not authorize production, a Vercel deployment, or a
pilot repository. Those remain separate boundaries.

## Clean-room verification

Download the release into a clean directory, not into a working Synclair
checkout:

```sh
RELEASE_DIR=/absolute/path/to/synclair-foundation-v0.1.0
mkdir "$RELEASE_DIR"
gh release download foundation-v0.1.0 \
  --repo cellfade/synclair \
  --dir "$RELEASE_DIR" \
  --pattern 'foundation-release.json' \
  --pattern 'foundation-files.json' \
  --pattern 'synclair-foundation.tar.gz' \
  --pattern 'release-tag.txt'
```

Run the offline structural and digest verifier from a separate checkout at the
same reviewed source revision. The clean directory contains assets only, so it
cannot run an `npm` script:

```sh
node /absolute/path/to/reviewed-synclair/scripts/verify-foundation-release.mjs \
  --directory "$RELEASE_DIR" \
  --tag-file "$RELEASE_DIR/release-tag.txt" \
  --repository-id 1308412422 \
  --source-commit <40-character-reviewed-merge-sha> \
  --release-tag foundation-v0.1.0
```

Then verify the GitHub OIDC provenance for both attested assets:

```sh
node /absolute/path/to/reviewed-synclair/scripts/verify-foundation-attestation.mjs \
  --directory "$RELEASE_DIR" \
  --repo cellfade/synclair \
  --source-commit <40-character-reviewed-merge-sha> \
  --release-tag foundation-v0.1.0
```

The attestation verifier trusts only GitHub's Actions OIDC issuer, the private
`cellfade/synclair` repository, and
`.github/workflows/publish-foundation-release.yml`; it rejects self-hosted
runners and requires the envelope's exact source commit.

Finally, read the release and tag back from GitHub and compare their target SHA
to the recorded merge commit:

```sh
gh release view foundation-v0.1.0 --repo cellfade/synclair
gh api repos/cellfade/synclair/git/ref/tags/foundation-v0.1.0
```

If GitHub Actions is intentionally disabled to avoid charges, stop before
publication. A local archive can be tested, but it is not a substitute for the
required GitHub provenance attestation.
