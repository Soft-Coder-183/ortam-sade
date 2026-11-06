package io.github.softcoder183.etucep

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/** Uygulamanın kendi dosyaları sahte bir https adresinden APK'nın içinden sunulur; dış adresler telefonun tarayıcısında açılır. */
object WebHost {
    const val ORIGIN = "https://uygulama.etucep.invalid"
    private val TYPES = mapOf("html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript", "css" to "text/css", "json" to "application/json",
        "svg" to "image/svg+xml", "wasm" to "application/wasm", "png" to "image/png", "bcmap" to "application/octet-stream", "pfb" to "application/octet-stream", "ttf" to "font/ttf")

    fun serve(context: Context, path: String): WebResourceResponse {
        val p = if (path == "/" || path.isEmpty()) "/index.html" else path
        val ext = p.substringAfterLast('.', "")
        return try {
            if (p.contains("..")) throw IllegalArgumentException()
            WebResourceResponse(TYPES[ext] ?: "application/octet-stream", "utf-8", context.assets.open("www$p"))
        } catch (e: Exception) { WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun configure(web: WebView, native: Native, onExternal: (String) -> Unit = {}) {
        native.web = web
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
        }
        web.addJavascriptInterface(native, "Native")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val u = request.url
                return if (u.toString().startsWith(ORIGIN)) serve(context = view.context, path = u.path ?: "/") else null
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url.toString()
                if (u.startsWith(ORIGIN)) return false
                onExternal(u)
                return true
            }
        }
    }
}
