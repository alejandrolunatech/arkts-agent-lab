// Everything the plugin does that needs no IDE: build the command line, run the process,
// parse the JSON, turn line/column into offsets. Plain Kotlin/JVM, so it is tested with plain JUnit.

plugins {
    id("org.jetbrains.kotlin.jvm")
}

repositories {
    mavenCentral()
}

kotlin {
    // IntelliJ Platform 2026.1 runs on Java 21, so the code it loads must target Java 21 or lower.
    jvmToolchain(21)
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
