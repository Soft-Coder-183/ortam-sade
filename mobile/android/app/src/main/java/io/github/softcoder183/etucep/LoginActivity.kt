package io.github.softcoder183.etucep

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject

/** Giriş penceresinin sonucunu köprüye taşır. */
object LoginBroker {
    var pending: ((Result<Pair<JSONArray, JSONObject?>>) -> Unit)? = null

    fun cookies(base: String): JSONArray {
        val out = JSONArray()
        CookieManager.getInstance().getCookie(base)?.split(";")?.forEach {
            val name = it.substringBefore("=").trim()
            if (name.isNotEmpty()) out.put(JSONObject().put("name", name).put("value", it.substringAfter("=", "").trim()))
        }
        return out
    }
}

/**
 * Sitenin kendi giriş sayfası uygulama içinde açılır. Kayıtlı bilgi varsa form doldurulur ve düğmeye basılır; doğrulama sorusu
 * çıkarsa ya da kod istenirse kullanıcı kendisi yanıtlar (atlatılmaz, çözülmez). Sayfada şifre alanı kalmayınca çerezler alınır.
 */
class LoginActivity : Activity() {
    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    private lateinit var cfg: JSONObject
    private var filled = false
    private var streak = 0
    private var finished = false
    private var typed: JSONObject? = null           // kullanıcının forma yazdığı e-posta ve şifre (diğer sitelere de girilebilsin diye)
    private val until = System.currentTimeMillis() + 10 * 60_000

    private val poll = object : Runnable {
        override fun run() {
            if (finished) return
            if (System.currentTimeMillis() > until) return end(Result.failure(Exception("Giriş için süre doldu")))
            val onSite = web.url?.startsWith(cfg.getString("base")) == true
            val pass = JSONObject.quote(cfg.getString("passwordField"))
            val user = if (cfg.isNull("userField")) "null" else JSONObject.quote(cfg.getString("userField"))
            val js = "(function(){var p=document.querySelector($pass),u=$user&&document.querySelector($user);" +
                "return JSON.stringify({done:document.readyState==='complete'&&!p,user:u?u.value:'',password:p?p.value:''})})()"
            web.evaluateJavascript(js) { raw ->
                val v = runCatching { JSONObject(JSONObject("{\"v\":$raw}").getString("v")) }.getOrNull()
                if (v != null && v.optString("user").isNotEmpty() && v.optString("password").isNotEmpty())
                    typed = JSONObject().put("user", v.getString("user")).put("password", v.getString("password"))
                streak = if (onSite && v?.optBoolean("done") == true) streak + 1 else 0
                if (streak >= 2) end(Result.success(LoginBroker.cookies(cfg.getString("base")) to typed)) else main.postDelayed(this, 1000) }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        cfg = JSONObject(intent.getStringExtra("ayar")!!)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE) }
        val bar = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(32, 8, 8, 8) }
        bar.addView(TextView(this).apply { text = cfg.getString("name") + " girişi"; textSize = 16f; setTextColor(Color.BLACK) }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(Button(this, null, android.R.attr.borderlessButtonStyle).apply { text = "Kapat"; setOnClickListener { end(Result.failure(Exception("Giriş penceresi kapatıldı"))) } })
        web = WebView(this)
        root.addView(bar)
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(i.left, i.top, i.right, i.bottom)
            WindowInsetsCompat.CONSUMED
        }
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = true
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        CookieManager.getInstance().setAcceptCookie(true)
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) { fill() }
        }
        web.loadUrl(cfg.getString("url"))
        main.postDelayed(poll, 1500)
    }

    /** Kayıtlı bilgiler bir kez forma yazılır; şifre yalnızca sitenin kendi sayfasına gider. */
    private fun fill() {
        if (filled || cfg.isNull("fill") || cfg.isNull("userField")) return
        if (web.url?.startsWith(cfg.getString("base")) != true) return
        val f = cfg.getJSONObject("fill")
        val args = JSONObject().put("u", cfg.getString("userField")).put("p", cfg.getString("passwordField")).put("s", cfg.opt("submit")).put("c", cfg.opt("captchaField"))
            .put("user", f.getString("user")).put("password", f.getString("password"))
        web.evaluateJavascript("""(function(a){
            var q=function(s){return s?document.querySelector(s):null}, u=q(a.u), p=q(a.p);
            if(!u||!p) return false;
            var set=function(el,v){var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(el,v);
              el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
            set(u,a.user);set(p,a.password);
            var b=q(a.s); if(b&&!(a.c&&q(a.c))) b.click();
            return true;})($args)""") { if (it == "true") filled = true }
    }

    private fun end(r: Result<Pair<JSONArray, JSONObject?>>) {
        if (finished) return
        finished = true
        CookieManager.getInstance().flush()
        LoginBroker.pending?.invoke(r)
        LoginBroker.pending = null
        finish()
    }

    @Deprecated("Android 12 ve öncesi") override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else end(Result.failure(Exception("Giriş penceresi kapatıldı")))
    }
    override fun onDestroy() { end(Result.failure(Exception("Giriş penceresi kapatıldı"))); web.destroy(); super.onDestroy() }
}
