// The IntelliJ Platform glue: thin classes that connect the IDE to :core.
// https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html

plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.intellij.platform")
}

repositories {
    mavenCentral()
    // The JetBrains repositories the IDE itself is downloaded from.
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    // :core and its JSON library are packed into the plugin's lib/ folder.
    // The Kotlin standard library is not: the IDE brings its own, and a plugin must use that one.
    // https://plugins.jetbrains.com/docs/intellij/using-kotlin.html#kotlin-standard-library
    implementation(project(":core")) {
        exclude(group = "org.jetbrains.kotlin")
    }

    intellijPlatform {
        // The IDE to compile against and to start with `runIde`.
        // 2026.1 is the newest release line that runs on Java 21; 2026.2 and later need Java 25.
        // https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html#platformVersions
        intellijIdea("2026.1.5.1")
    }
}

intellijPlatform {
    // The name of the plugin's folder and zip. Without it, it would be "plugin", after this subproject.
    projectName = "arkts-lab-checker"

    pluginConfiguration {
        ideaVersion {
            // Written into plugin.xml as <idea-version since-build="261"/>: IDEs from 2026.1 on.
            sinceBuild = "261"
            // No upper limit. The default would be "261.*", this release line only.
            untilBuild = provider { null }
        }
    }
}
