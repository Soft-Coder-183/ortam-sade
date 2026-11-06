package io.github.softcoder183.etucep

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.coroutines.resume

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.channels(this)
        Schedule.ensure(this)
    }
}

object Notifications {
    const val LINK = "baglanti"
    private const val CHANNEL = "yeni_icerik"
    private const val QUIET = "denetim"
    private const val ASK = 42
    private val nextId = AtomicInteger((System.currentTimeMillis() / 1000).toInt() and 0xFFFFFF)

    fun channels(c: Context) {
        val m = c.getSystemService(NotificationManager::class.java)
        m.createNotificationChannel(NotificationChannel(CHANNEL, "Yeni içerik ve hatırlatmalar", NotificationManager.IMPORTANCE_DEFAULT))
        m.createNotificationChannel(NotificationChannel(QUIET, "Arka plan kontrolü", NotificationManager.IMPORTANCE_MIN))
    }
    fun allowed(c: Context) = c.getSystemService(NotificationManager::class.java).areNotificationsEnabled()
    fun ask(a: Activity) {
        if (Build.VERSION.SDK_INT >= 33 && a.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            a.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), ASK)
    }
    fun show(c: Context, title: String, body: String, link: String) {
        val id = nextId.incrementAndGet()
        val open = Intent(c, MainActivity::class.java).putExtra(LINK, link).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, CHANNEL).setSmallIcon(R.drawable.ic_bildirim).setContentTitle(title).setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi).build()
        c.getSystemService(NotificationManager::class.java).notify(id, n)
    }
    fun working(c: Context) = NotificationCompat.Builder(c, QUIET).setSmallIcon(R.drawable.ic_bildirim).setContentTitle("Yeni içerik kontrol ediliyor").setOngoing(true).build()
}

/**
 * Uygulama kapalıyken bildirim kontrolü. İki yol birlikte çalışır:
 * WorkManager (15 dakikada bir, Android uygun zamanda çalıştırır) ve Doze'da da uyanan 30 dakikalık alarm.
 * Gerçek aralığı Android belirler; pil kısıtlaması kapatılırsa gecikme azalır.
 */
object Schedule {
    private const val PERIODIC = "periyodik_kontrol"
    private const val ONCE = "tek_kontrol"
    private val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun ensure(c: Context) {
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<CheckWorker>(15, TimeUnit.MINUTES).setConstraints(net).build())
        alarm(c)
    }
    fun alarm(c: Context) {
        val pi = PendingIntent.getBroadcast(c, 1, Intent(c, AlarmReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        c.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 30 * 60_000, pi)
    }
    fun now(c: Context) {
        WorkManager.getInstance(c).enqueueUniqueWork(ONCE, ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<CheckWorker>().setConstraints(net).setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST).build())
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Schedule.alarm(c); Schedule.now(c) }
}
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Schedule.ensure(c) }
}

/** Görünmez bir WebView'de çekirdeği açar; süresi gelen kontroller çalışınca kapanır. Uygulama öndeyse çekirdek zaten kendi zamanlayıcısıyla çalışır. */
class CheckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun getForegroundInfo() = ForegroundInfo(7, Notifications.working(applicationContext))

    override suspend fun doWork(): Result {
        if (AppState.foreground || !running.compareAndSet(false, true)) return Result.success()
        try {
            var web: WebView? = null
            withTimeoutOrNull(8 * 60_000L) {
                suspendCancellableCoroutine { cont ->
                    Handler(Looper.getMainLooper()).post {
                        val w = WebView(applicationContext)
                        web = w
                        val native = Native(applicationContext) { if (cont.isActive) cont.resume(Unit) }
                        WebHost.configure(w, native)
                        w.loadUrl(WebHost.ORIGIN + "/arka-plan.html")
                    }
                }
            }
            withContext(Dispatchers.Main) { web?.destroy() }
        } finally { running.set(false) }
        return Result.success()
    }
    companion object { private val running = AtomicBoolean(false) }
}
