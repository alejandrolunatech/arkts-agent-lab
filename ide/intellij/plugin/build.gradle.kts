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
        // The IDE to compile against and to start with `runIde`: the oldest release line the plugin loads in.
        // DevEco Studio 6.1.1 is built on 2024.3 (its build number starts with 243), and a plugin that
        // supports a range of versions is built against the lowest one:
        // https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html#platformVersions
        // Before 2025.3 the open source IDE is its own download, IntelliJ IDEA Community.
        intellijIdeaCommunity("2024.3.6")
    }
}

kotlin {
    compilerOptions {
        // The IDE's own Kotlin standard library is used, and 2024.3 bundles 2.0.21: see core/build.gradle.kts.
        apiVersion = org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0
    }
}

intellijPlatform {
    // The name of the plugin's folder and zip. Without it, it would be "plugin", after this subproject.
    projectName = "arkts-lab-checker"

    // No instrumentation of the compiled classes. It needs the Java compiler tools of the IDE, and for
    // 2024.3 the build could not resolve one of their dependencies (org.jetbrains:annotations:24.0.0).
    // The plugin loses nothing: it has no Java and no GUI Designer form, and Kotlin checks its own nulls.
    // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-extension.html
    instrumentCode = false

    pluginConfiguration {
        ideaVersion {
            // Written into plugin.xml as <idea-version since-build="243"/>: IDEs from 2024.3 on.
            sinceBuild = "243"
            // No upper limit. The default would be "243.*", this release line only.
            untilBuild = provider { null }
        }
    }
}
