# ArkTS Lab Checker for IntelliJ-based IDEs

A small IntelliJ Platform plugin. It runs this lab's checker on the `.ets` file you are editing and shows
what it finds in the editor: syntax errors, type errors against the HarmonyOS API, and TypeScript that ArkTS
forbids. Each message names its compiler code (`TS2322`) or its rule (`arkts-no-any-unknown`).

It is a prototype for learning how an IDE plugin is put together. Read [Limits](#limits) before relying on it.

Not affiliated with Huawei or JetBrains.

## What it does

- Underlines each finding as an error or a warning. The tooltip is the checker's message with its code.
- Checks the text in the editor, saved or not, a moment after you stop typing.
- Has a settings page with two paths: the lab checkout and the `node` executable.
- Tells you once, in a balloon with a link to the settings, when the checker cannot run.
- Adds "Copy ArkTS Checker Findings" to the editor's context menu. It copies the findings as text, in the
  format the lab prints. That is the feedback the lab's evaluation loop gives a model.

The plugin contains no checker. It starts the one in this repository:

```
node <lab>/node_modules/tsx/dist/cli.mjs <lab>/src/cli.ts check --stdin --json --filename <name>.ets
```

The file's text goes in on standard input, one JSON object comes out. The format is described in
[`docs/EDITOR.md`](../../docs/EDITOR.md).

## The design decision: an external annotator, not the LSP API

The lab also has a language server (`src/cli.ts lsp`), and the IntelliJ Platform has an API for language
servers. This plugin does not use it. The reason is where that API exists.

The SDK documentation says, under
[Language Server Protocol, Supported IDEs](https://plugins.jetbrains.com/docs/intellij/language-server-protocol.html#supported-ides):

> The integration with the Language Server Protocol is created as an extension to the commercial
> IntelliJ-based IDEs. Therefore, plugins using Language Server integration are not available in IntelliJ IDEA
> open source builds and Android Studio from Google.

The IDE this prototype is aimed at is DevEco Studio, which its own user guide describes as "powered by the
IntelliJ IDEA Community Edition"
([DevEco Studio User Guide, OpenHarmony documentation](https://gitcode.com/openharmony/docs/blob/OpenHarmony-4.0-Release/en/application-dev/quick-start/deveco-studio-user-guide-for-openharmony.md)).
A plugin that needs the LSP API could not load there.

The other design needs only the open source platform. The documentation describes it under
[External Annotator](https://plugins.jetbrains.com/docs/intellij/syntax-highlighting-and-error-highlighting.html#external-annotator):
it is the extension for "external tools for validating files", it runs "only after all other background
processing has completed", and it uses the same `AnnotationHolder` as any other annotator. So the plugin
depends on one module, `com.intellij.modules.platform`, which every IntelliJ-based IDE has.

What this choice costs: an external annotator only gives diagnostics. Hover, completion and navigation would
each be a separate extension. A language server would bring them through one protocol.

## Build it

It needs JDK 21 and a network connection: the build downloads Gradle, the libraries and an IntelliJ IDEA to
compile against.

Run inside `ide/intellij/`:

```
./gradlew buildPlugin
```

The plugin is then in `plugin/build/distributions/arkts-lab-checker-0.1.0.zip`. It can be installed in an
IDE with Settings | Plugins | gear icon | Install Plugin from Disk.

To run only the tests of the part that needs no IDE, also inside `ide/intellij/`:

```
./gradlew :core:test
```

On a machine that cannot reach the JetBrains repositories, leave the plugin subproject out. Inside
`ide/intellij/`:

```
./gradlew -PcoreOnly :core:test
```

## Try it

The checker needs the lab's dependencies. Run inside the repository folder (two levels up from here):

```
npm ci
```

Find the full path of `node`. Run anywhere:

```
which node
```

Start a separate IntelliJ IDEA with the plugin installed. Run inside `ide/intellij/`:

```
./gradlew runIde
```

In that IDE:

1. Open Settings | Tools | ArkTS Lab Checker.
2. Set "Lab checkout" to this repository's folder and "Node executable" to the path from `which node`.
3. Open this repository as a project and open `tasks/U02-todo-list/trap.ets`.

About two seconds later the findings appear. Hover over one to read its message. Right-click in the editor
for "Copy ArkTS Checker Findings".

## What it targets

| | Version | Why |
|---|---|---|
| IDE to compile against and for `runIde` | IntelliJ IDEA 2026.1.5.1 | 2026.1 is the newest release line that runs on Java 21. 2026.2 and later need Java 25 ([table](https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html#platformVersions)). |
| IDEs it declares itself compatible with | build 261 (2026.1) and later, no upper limit | The documentation recommends not setting `until-build` ([`idea-version`](https://plugins.jetbrains.com/docs/intellij/plugin-configuration-file.html#idea-plugin__idea-version)). |
| JDK | 21 | Required by IntelliJ Platform 2026.1 (same table). |
| IntelliJ Platform Gradle Plugin | 2.20.1 | The current release in its [documentation](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html). It needs Gradle 9.0.0 or later. |
| Gradle | 9.8.1 (wrapper, with checksum) | The version the official [plugin template](https://github.com/JetBrains/intellij-platform-plugin-template) uses. |
| Kotlin | 2.3.20 | The Kotlin standard library that 2026.1 bundles ([table](https://plugins.jetbrains.com/docs/intellij/using-kotlin.html#kotlin-standard-library)). The plugin does not ship its own. |
| Gson | 2.13.2 | Reads the checker's JSON. Packed into the plugin. |
| JUnit | 6.1.3 | Tests of `core` only. |

All versions are pinned: plugins in `settings.gradle.kts`, the rest in the two `build.gradle.kts` files.

Gson is used from Maven Central and packed into the plugin, although the IDE has its own copy. The
documentation recommends the IDE's copy for the Kotlin libraries; I found no such statement for Gson, and a
plain Maven dependency lets `core` be built and tested without any IDE.

## How it is put together

Two Gradle subprojects.

**`core`** is plain Kotlin. It knows nothing about IntelliJ and is tested with plain JUnit.

| File | What it does |
|---|---|
| `CheckerSetup.kt` | Checks the two paths and builds the command line |
| `ProcessRunner.kt` | Runs a process with input, a timeout and a way to cancel |
| `FindingsJson.kt` | Reads the JSON into `Finding` objects |
| `LineIndex.kt` | Turns 1-based line and column into offsets in the text |
| `Checker.kt` | Puts those together: text in, findings or a reason out |

**`plugin`** is the glue. Each class is one IntelliJ Platform concept.

### How the pieces map to IntelliJ Platform concepts

| Extension point in `plugin.xml` | Class | Concept |
|---|---|---|
| `com.intellij.externalAnnotator` | `ArkTsExternalAnnotator` | [External annotator](https://plugins.jetbrains.com/docs/intellij/syntax-highlighting-and-error-highlighting.html#external-annotator): three steps, the slow one on a background thread |
| `com.intellij.fileType` | `ArkTsFileType` | [File type](https://plugins.jetbrains.com/docs/intellij/registering-file-type.html): a name and an icon for a kind of file |
| `com.intellij.fileTypeDetector` | `ArkTsFileTypeDetector` | Decides the file type of a file no pattern matched |
| `com.intellij.applicationConfigurable` | `ArkTsCheckerConfigurable` | [Settings page](https://plugins.jetbrains.com/docs/intellij/settings-guide.html) |
| none: `@Service` and `@State` on the class | `ArkTsCheckerSettings` | [Light service](https://plugins.jetbrains.com/docs/intellij/plugin-services.html#light-services) with [persistent state](https://plugins.jetbrains.com/docs/intellij/persisting-state-of-components.html) |
| none: `@Service` on the class | `CheckerProblemNotifier` | Light service that remembers what it already reported |
| `com.intellij.notificationGroup` | used by `CheckerProblemNotifier` | [Notification balloon](https://plugins.jetbrains.com/docs/intellij/notification-balloons.html) |
| `<action>` | `CopyFindingsAction` | [Action](https://plugins.jetbrains.com/docs/intellij/action-system.html): a menu item with `update` and `actionPerformed` |

### Threads

The [threading rules](https://plugins.jetbrains.com/docs/intellij/threading-model.html) say that nothing slow
may run on the UI thread. The checker takes about two seconds, so where it runs matters.

- `collectInformation` runs inside a read action. It only copies the text and the settings.
- `doAnnotate` runs on a background thread with no lock held. The process is started here.
- While the process runs, the plugin asks the platform every 25 ms whether the result is still wanted
  (`ProgressManager.checkCanceled()`). When you type, the platform cancels the run. The process and its
  child process are killed, and the cancellation exception is passed on, as
  [the documentation requires](https://plugins.jetbrains.com/docs/intellij/background-processes.html).
- A check that takes longer than 20 seconds is stopped and reported.
- `apply` runs inside a read action again. It only creates annotations from offsets computed before.

### Two decisions that are not obvious

**The plugin does not claim the `.ets` extension.** The usual `extensions="ets"` on `<fileType>` would be
harmful in an IDE that has its own ArkTS support. When an installed plugin and a bundled plugin declare the
same extension, the platform gives it to the installed one without asking
([`ConflictingFileTypeMappingTracker`](https://github.com/JetBrains/intellij-community/blob/261/platform/platform-impl/src/com/intellij/openapi/fileTypes/impl/ConflictingFileTypeMappingTracker.java):
"if plugin tries to override bundled file type, assign matcher to the newFileType"). So the file type is
registered without a pattern, and a
[`FileTypeDetector`](https://github.com/JetBrains/intellij-community/blob/261/platform/core-api/src/com/intellij/openapi/fileTypes/FileTypeRegistry.java)
assigns it. The platform asks detectors only about files whose name matched nothing. In IntelliJ IDEA, which
has no `.ets` support of its own that I could find, `.ets` files become "ArkTS Lab" files, shown as plain
text. In an IDE that knows `.ets`, the detector is never asked.

What I checked: the file types of the open source platform and its bundled TextMate grammar for TypeScript
(`.ts`, `.cts`, `.mts`, `.tsx`) in `intellij-community`, branch 262. I could not check closed source plugins.

**The annotator is registered for every language** (`language=""`) and picks its files by name. A file's
language depends on which plugin owns the file type, and that differs from IDE to IDE. The name does not. It
also keeps working if you map `*.ets` to another file type yourself in Settings | Editor | File Types.

## What is tested

- `core` has 64 tests. They cover the JSON, the offsets (Windows line breaks, findings with no length, the end
  of the file), the path checks, and real processes: one that never reads its input, one that floods its
  output, one that hangs, one that is cancelled.
- Four of them (`LabContractTest`) run the real checker of this repository. They are skipped when `node` or
  the lab's `node_modules` is missing.
- `plugin` has no automated tests. CI compiles it against the IDE, builds the zip and runs the
  `verifyPluginStructure` task. Whether it behaves in the editor is checked by hand with `runIde`.

## Limits

- **A prototype.** Written to learn the platform, not to be published.
- **Not tested in DevEco Studio.** It is compiled against IntelliJ IDEA 2026.1 and declares itself compatible
  from build 261. An IDE built on an older platform will refuse to load it. Making it load there means
  compiling against that older platform and checking every API used here against it.
- **Not affiliated with Huawei or JetBrains.**
- **Slow.** The checker builds a whole TypeScript program for every check, with the HarmonyOS declarations.
  That takes about two seconds, so findings lag behind typing.
- **Single file.** The file is checked alone. An import of another file of the project is reported as not
  found.
- **Diagnostics only.** No syntax highlighting, completion, navigation or quick fixes. A `.ets` file is shown
  as plain text unless another plugin provides more.
- **Local only.** The checker is started on the machine the IDE runs on, with the two configured paths.
- **A temporary copy.** The plugin writes no file. The checker it starts writes the text to a private folder
  in the system temp directory for the check and removes it afterwards.
- **No telemetry, no network.** The plugin starts one local process and nothing else.
