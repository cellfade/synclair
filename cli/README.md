# synclair

**Guarded legacy entrypoint for the private Cellfade foundation.**

```
npx synclair new --cellfade-foundation my-project
# Temporary explicit path until @cellfade/create-synclair is released.
cd my-project
npm install && npm run dev    # hub at http://localhost:4100/synclair
```

Synclair gives a project one aligned source of truth — design tokens, a live
component library (shadcn-style registry with UX docs), and an AI knowledge
layer — served by an in-repo hub built for humans browsing and agents building.

Bare `npx synclair new my-project` fails closed and no longer clones the public
lineage. The temporary explicit command clones only the private
[Cellfade foundation](https://github.com/cellfade/synclair)
and wires it as `upstream`. The source transfers to you (GPL-3.0); nothing phones
home, and updates stay opt-in (`npm run call-home` + the `synclair-sync` skill).
The temporary path will be removed after the private factory package passes its
clean install-and-execute release gate.

Docs: [new project](https://github.com/cellfade/synclair/blob/main/docs/new-project.md)
· [existing app](https://github.com/cellfade/synclair/blob/main/docs/existing-project.md)
· [architecture](https://github.com/cellfade/synclair/blob/main/docs/foundation-model.md)
