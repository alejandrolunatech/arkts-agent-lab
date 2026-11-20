# Build output of DevEco Studio

What the Build panel of DevEco Studio 6.1.1 Release (build 6.1.1.280, SDK 6.1.1(24)) printed on 20 November
2026 for pages of [`docs/deveco-probes/`](../../../docs/deveco-probes/): `probe-a.txt` and `probe-c.txt` for
the pages of those names, `success.txt` for `probe-d.ets`. Two things were changed: the home folder in the
paths is `/Users/dev`, and most of the lines that only say a build task finished are left out.
The tests of the reader in `src/build/` run on these files.
