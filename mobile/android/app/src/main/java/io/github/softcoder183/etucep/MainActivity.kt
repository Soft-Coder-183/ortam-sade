package io.github.softcoder183.etucep

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import android.window.OnBackInvokedDispatcher
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var chooser: ValueCallback<Array<Uri>>? = null

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        root = FrameLayout(this)
        web = WebView(this)
        web.setBackgroundColor(0)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        // Durum çubuğu, alt gezinme çubuğu ve klavye kadar içerik içeri alınır
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(i.left, i.top, i.right, i.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setBars((resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES)

        val native = Native(this)
        WebHost.configure(web, native) { native.openUrl(it) }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                chooser?.onReceiveValue(null)
                chooser = callback
                val pick = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                    .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                startActivityForResult(Intent.createChooser(pick, "Dosya seç"), PICK)
                return true
            }
        }
        web.loadUrl(WebHost.ORIGIN + "/index.html" + linkOf(intent))
        Notifications.ask(this)
        if (Build.VERSION.SDK_INT >= 33)
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
    }

    private fun linkOf(i: Intent?) = i?.getStringExtra(Notifications.LINK)?.takeIf { it.startsWith("#/") } ?: ""

    /** Bildirime basılınca ilgili sayfa açılır. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val link = linkOf(intent)
        if (link.isNotEmpty()) web.evaluateJavascript("location.hash=" + JSONObject.quote(link), null)
    }

    private fun back() = web.evaluateJavascript("__back&&__back()") { if (it != "true") moveTaskToBack(true) }
    @Deprecated("Android 12 ve öncesi") override fun onBackPressed() = back()

    override fun onResume() {
        super.onResume()
        AppState.foreground = true
        web.onResume()
        web.evaluateJavascript("window.__resume&&__resume()", null)
    }
    override fun onPause() {
        AppState.foreground = false
        web.onPause()
        super.onPause()
    }
    override fun onDestroy() { web.destroy(); super.onDestroy() }

    @Deprecated("Basit dosya seçimi için yeterli")
    override fun onActivityResult(request: Int, result: Int, data: Intent?) {
        super.onActivityResult(request, result, data)
        if (request != PICK) return
        val clip = data?.clipData
        val uris = when {
            result != RESULT_OK -> null
            clip != null -> Array(clip.itemCount) { clip.getItemAt(it).uri }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        chooser?.onReceiveValue(uris)
        chooser = null
    }

    /** Durum çubuğu ve alt çubuk uygulamanın temasına uyar (Hesap'taki Görünüm ayarı dahil). */
    fun setBars(dark: Boolean) = runOnUiThread {
        root.setBackgroundColor(if (dark) 0xFF121418.toInt() else 0xFFF4F5F7.toInt())
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
    }

    companion object { private const val PICK = 41 }
}

object AppState { @Volatile var foreground = false }
