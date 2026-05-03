# co.kosta.external-models — moved

This tweak has moved to its own repository:

**https://github.com/ildunari/codex-plusplus-external-models**

To install:

```bash
git clone https://github.com/ildunari/codex-plusplus-external-models.git ~/LocalDev/codex-plusplus-external-models
codexplusplus dev ~/LocalDev/codex-plusplus-external-models --replace
```

The historical version that lived here (commits `58a68c5` "Add Kosta external models tweak" and `6a0599c` "Group VibeProxy models in picker") was extracted via `git subtree split` and now lives at the start of the new repo's history.

This stub directory exists so the new repo's location is discoverable from the monorepo. The tweak loader ignores directories without a `manifest.json`, so this won't be loaded.
