# synclair

**Source-only guarded legacy entrypoint for the private Cellfade foundation.**

```
gh repo clone cellfade/synclair my-project-synclair
git -C my-project-synclair remote rename origin upstream
cd my-project-synclair
npm install
npm run bootstrap:foundation
npm run verify:foundation
npm run dev    # hub at http://localhost:4100/synclair
```

Do not run `npx synclair`: the public npm package with that name is unrelated.
The local entrypoint remains only for deprecation tests and source development:

```bash
node cli/bin/synclair.mjs --help
```

Synclair gives a project one aligned source of truth — design tokens, a live
component library (shadcn-style registry with UX docs), and an AI knowledge
layer — served by an in-repo hub built for humans browsing and agents building.

The authenticated GitHub clone reaches the private
[Cellfade foundation](https://github.com/cellfade/synclair). The source transfers
to you (GPL-3.0); nothing phones
home, and updates stay opt-in (`npm run call-home` + the `synclair-sync` skill).
The guarded source entrypoint will be removed after the private factory package
passes its clean install-and-execute release gate.

Docs: [new project](https://github.com/cellfade/synclair/blob/main/docs/new-project.md)
· [existing app](https://github.com/cellfade/synclair/blob/main/docs/existing-project.md)
· [architecture](https://github.com/cellfade/synclair/blob/main/docs/foundation-model.md)
