package io.github.softcoder183.etucep

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Yerel şifreleme: rastgele bir AES-256 veri anahtarı, Android Keystore'daki (mümkünse donanım korumalı) anahtarla sarılıp saklanır.
 * Çerezler, kayıtlı giriş bilgileri, kişisel önbellek ve bildirimler bu anahtarla AES-256-GCM şifrelenir. Dosyalar uygulamanın özel klasöründedir
 * ve yedeğe alınmaz. Telefon kilitliyken de arka plan kontrolü çalışabilsin diye anahtar kullanıcı doğrulaması istemez.
 */
object Vault {
    private const val ALIAS = "etucep_anahtar"
    private val MAGIC = "ECV1".toByteArray()
    private val random = SecureRandom()
    @Volatile private var data: SecretKey? = null

    private fun wrapKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        return gen.generateKey()
    }

    @Synchronized private fun key(context: Context): SecretKey {
        data?.let { return it }
        val f = File(context.filesDir, "anahtar.enc")
        if (f.isFile) runCatching {
            val b = f.readBytes()
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, wrapKey(), GCMParameterSpec(128, b, 0, 12))
            return SecretKeySpec(c.doFinal(b, 12, b.size - 12), "AES").also { data = it }
        }
        // İlk açılış ya da Keystore sıfırlanmış: yeni anahtar üretilir, eski şifreli dosyalar okunamaz sayılır
        val raw = ByteArray(32).also(random::nextBytes)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, wrapKey())
        atomic(f, c.iv + c.doFinal(raw))
        return SecretKeySpec(raw, "AES").also { data = it }
    }

    fun read(context: Context, f: File): String? = runCatching {
        if (!f.isFile) return null
        val b = f.readBytes()
        if (b.size < 32 || !b.copyOfRange(0, 4).contentEquals(MAGIC)) return null
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key(context), GCMParameterSpec(128, b, 4, 12))
        String(c.doFinal(b, 16, b.size - 16), Charsets.UTF_8)
    }.getOrNull()

    fun write(context: Context, f: File, text: String) {
        val iv = ByteArray(12).also(random::nextBytes)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key(context), GCMParameterSpec(128, iv))
        atomic(f, MAGIC + iv + c.doFinal(text.toByteArray(Charsets.UTF_8)))
    }

    /** Önce geçici dosyaya yazılır: telefon kapanırsa eski dosya bozulmaz. */
    fun atomic(f: File, bytes: ByteArray) {
        f.parentFile?.mkdirs()
        val tmp = File(f.path + ".tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
    }
}
