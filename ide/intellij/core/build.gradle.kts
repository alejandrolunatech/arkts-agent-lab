// Everything the plugin does that needs no IDE: build the command line, run the process,
// parse the JSON, turn line/column into offsets. Plain Kotlin/JVM, so it is tested with plain JUnit.

plugins {
    id("org.jetbrains.kotlin.jvm")
}

repositories {
    mavenCentral()
}

kotlin {
    // IntelliJ Platform 2024.3 and 2026.1 both run on Java 21, so the code they load must target Java 21 or lower.
    jvmToolchain(21)
    compilerOptions {
        // Inside an IDE this code runs on the IDE's Kotlin standard library, not on the compiler's.
        // The oldest IDE the plugin loads in, 2024.3, bundles 2.0.21, so no API newer than 2.0 may be used.
        // The compiler warns that 2.0 is deprecated; that is the price of loading in 2024.3.
        // https://plugins.jetbrains.com/docs/intellij/using-kotlin.html#kotlin-standard-library
        apiVersion = org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0
    }
}

dependencies {
    implementation("com.google.code.gson:gson:2.13.2")

    testImplementation(platform("org.junit:junit-bom:6.1.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // LabContractTest runs the real checker of the lab this directory lives in, two levels up.
    systemProperty("arktsLabDirectory", rootDir.resolve("../..").normalize().path)
    testLogging {
        events("passed", "skipped", "failed")
    }
}
