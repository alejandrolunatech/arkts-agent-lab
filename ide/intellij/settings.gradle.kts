rootProject.name = "arkts-lab-checker"

// Every plugin version is pinned here, in one place.
pluginManagement {
    repositories {
        gradlePluginPortal()
    }
    plugins {
        // Kotlin 2.3.20 is the Kotlin standard library that IntelliJ Platform 2026.1 bundles:
        // https://plugins.jetbrains.com/docs/intellij/using-kotlin.html#kotlin-standard-library
        id("org.jetbrains.kotlin.jvm") version "2.3.20"
        // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html
        id("org.jetbrains.intellij.platform") version "2.20.1"
    }
}

// Pure Kotlin/JVM: command line, process, JSON, offsets. Needs only Maven Central.
include("core")

// The IntelliJ Platform glue. Needs the JetBrains repositories to download the IDE.
// `./gradlew -PcoreOnly :core:test` leaves it out, for machines that cannot reach them.
if (!providers.gradleProperty("coreOnly").isPresent) {
    include("plugin")
}
