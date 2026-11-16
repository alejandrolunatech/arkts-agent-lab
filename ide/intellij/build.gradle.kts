// Nothing is built here. The two plugins are only loaded once, for both subprojects;
// each subproject applies what it needs. Their versions are in settings.gradle.kts.
plugins {
    id("org.jetbrains.kotlin.jvm") apply false
    id("org.jetbrains.intellij.platform") apply false
}
