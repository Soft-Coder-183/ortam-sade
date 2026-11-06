import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Sürüm tek yerde: package.json
val surum = (JsonSlurper().parse(rootDir.resolve("../../package.json")) as Map<*, *>)["version"] as String
val (ana, ara, yama) = surum.split(".").map { it.toInt() }

android {
    namespace = "io.github.softcoder183.etucep"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.softcoder183.etucep"
        minSdk = 29
        targetSdk = 36
        versionCode = ana * 10000 + ara * 100 + yama
        versionName = surum
    }

    // İmza anahtarı depoda değildir: yerelde imza/ klasöründe, GitHub Actions'ta gizli değişkenlerde durur.
    val anahtar = System.getenv("ETUCEP_KEYSTORE") ?: rootDir.resolve("imza/etucep.keystore").path
    signingConfigs {
        create("surum") {
            storeFile = file(anahtar)
            storePassword = System.getenv("ETUCEP_KEY_PASSWORD") ?: rootDir.resolve("imza/parola.txt").takeIf { it.exists() }?.readText()?.trim()
            keyAlias = "etucep"
            keyPassword = storePassword
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (file(anahtar).exists()) signingConfig = signingConfigs.getByName("surum")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.work:work-runtime-ktx:2.10.5")
}
