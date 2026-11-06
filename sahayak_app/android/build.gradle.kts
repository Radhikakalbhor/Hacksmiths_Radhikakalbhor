allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    // AGP 8.4+ compatibility patch for flutter_inappwebview_android
    if (name.contains("flutter_inappwebview")) {
        val bf = file("$projectDir/build.gradle")
        if (bf.exists()) {
            val content = bf.readText()
            if (content.contains("proguard-android.txt")) {
                bf.writeText(content.replace("proguard-android.txt", "proguard-android-optimize.txt"))
            }
        }
    }
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
