// Ortam Sade masaüstü penceresi. Yerel sunucuyu (Node.js, server\start.mjs) görünmez başlatır, arayüzü tek pencerede
// (Edge WebView2) gösterir. Pencere kapatılınca uygulama sistem tepsisine iner, bildirimler gelmeye devam eder; tepsideki
// "Kapat" sunucuyu da durdurur. "--arka": pencere açılmadan yalnızca tepside başlar (bilgisayar açılınca).
// "ortamsade:#/..." bağlantısı (Windows bildirimine tıklama) açık pencerede o sayfayı açar. Aynı anda tek kopya çalışır.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net.Http;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace OrtamSade
{
    static class Program
    {
        public const int Port = 3000;
        public static readonly string Url = $"http://localhost:{Port}/";
        static readonly string PipeName = "OrtamSade.Pencere." + Environment.UserName;

        [STAThread]
        static void Main(string[] args)
        {
            bool background = args.Any(a => a.Equals("--arka", StringComparison.OrdinalIgnoreCase) || a.Equals("arka", StringComparison.OrdinalIgnoreCase));
            string link = args.FirstOrDefault(a => a.StartsWith("ortamsade:", StringComparison.OrdinalIgnoreCase));
            using (var mutex = new Mutex(true, @"Local\OrtamSade.Pencere", out bool first))
            {
                if (!first) { Signal(link ?? (background ? "" : "goster")); return; }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                var root = FindRoot();
                if (root == null)
                {
                    MessageBox.Show("Uygulama dosyaları bulunamadı (server\\start.mjs). Ortam Sade'yi yeniden kurun.", "Ortam Sade", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
                // Beklenmeyen hatalar .cache\pencere-hata.log'a yazılır (uygulama sessizce kapanmasın, nedeni bulunabilsin)
                string errLog = Path.Combine(root, ".cache", "pencere-hata.log");
                void LogError(object e) { try { File.AppendAllText(errLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {e}" + Environment.NewLine); } catch { } }
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += (s, e) => LogError(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (s, e) => LogError(e.ExceptionObject);
                RegisterProtocol();
                var app = new TrayApp(root, background, link);
                StartPipe(app);
                Application.Run(app);
            }
        }

        // Uygulama klasörü: exe'nin yanında (paket) ya da üst klasörlerde (geliştirme: masaustu\bin\...) server\start.mjs olan klasör
        static string FindRoot()
        {
            var dir = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
            for (int i = 0; dir != null && i < 6; i++, dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "server", "start.mjs"))) return dir.FullName;
            return null;
        }

        // Windows bildirimine tıklanınca uygulamanın açılması için "ortamsade:" bağlantı türü (yalnızca bu kullanıcı, yönetici izni gerekmez)
        static void RegisterProtocol()
        {
            try
            {
                string exe = Application.ExecutablePath, cmd = $"\"{exe}\" \"%1\"";
                using (var k = Registry.CurrentUser.CreateSubKey(@"Software\Classes\ortamsade"))
                {
                    k.SetValue("", "URL:Ortam Sade");
                    k.SetValue("URL Protocol", "");
                    using (var ic = k.CreateSubKey("DefaultIcon")) ic.SetValue("", $"\"{exe}\",0");
                    using (var c = k.CreateSubKey(@"shell\open\command")) if ((c.GetValue("") as string) != cmd) c.SetValue("", cmd);
                }
            }
            catch { }
        }

        // İkinci kopya: çalışan kopyaya pencereyi göstermesini (ya da bağlantıyı açmasını) söyler ve kapanır
        static void Signal(string message)
        {
            try
            {
                using (var c = new NamedPipeClientStream(".", PipeName, PipeDirection.Out))
                {
                    c.Connect(3000);
                    var b = Encoding.UTF8.GetBytes(message + "\n");
                    c.Write(b, 0, b.Length);
                }
            }
            catch { }
        }

        static void StartPipe(TrayApp app)
        {
            var t = new Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        using (var s = new NamedPipeServerStream(PipeName, PipeDirection.In, 1))
                        {
                            s.WaitForConnection();
                            using (var r = new StreamReader(s, Encoding.UTF8))
                            {
                                var msg = (r.ReadLine() ?? "").Trim();
                                app.Post(() => app.Handle(msg));
                            }
                        }
                    }
                    catch { Thread.Sleep(500); }
                }
            }) { IsBackground = true };
            t.Start();
        }

        public static bool PortOpen()
        {
            try
            {
                using (var c = new TcpClient())
                {
                    var t = c.ConnectAsync("127.0.0.1", Port);
                    return t.Wait(400) && c.Connected;
                }
            }
            catch { return false; }
        }
    }

    // Uygulamanın ömrü: sunucu süreci, tepsi simgesi ve (gerektiğinde) pencere
    sealed class TrayApp : ApplicationContext
    {
        readonly string root;
        readonly NotifyIcon tray;
        readonly Control ui = new Control();
        readonly Icon icon;
        MainWindow window;
        Process server;
        bool exiting, hintShown;
        string pendingLink;

        public TrayApp(string root, bool background, string link)
        {
            this.root = root;
            _ = ui.Handle;                        // diğer iş parçacıklarından gelen istekler (Post) bu tutamaçla arayüze aktarılır
            icon = LoadIcon();
            var menu = new ContextMenuStrip();
            menu.Items.Add("Ortam Sade'yi aç", null, (s, e) => Show());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Kapat (bildirimler de durur)", null, (s, e) => Exit());
            tray = new NotifyIcon { Icon = icon, Text = "Ortam Sade", ContextMenuStrip = menu, Visible = true };
            tray.MouseClick += (s, e) => { if (e.Button == MouseButtons.Left) Show(); };
            StartServer();
            pendingLink = link;
            if (!background) Show();
        }

        static Icon LoadIcon()
        {
            try
            {
                using (var s = typeof(TrayApp).Assembly.GetManifestResourceStream("simge.ico"))
                    if (s != null) return new Icon(s);
            }
            catch { }
            return SystemIcons.Application;
        }

        public void Post(Action a) { try { ui.BeginInvoke(a); } catch { } }

        // İkinci kopyadan ya da bildirimden gelen istek
        public void Handle(string msg)
        {
            if (msg.StartsWith("ortamsade:", StringComparison.OrdinalIgnoreCase)) { pendingLink = msg; Show(); }
            else if (msg == "goster") Show();
        }

        void Show()
        {
            if (exiting) return;
            if (window == null || window.IsDisposed)
            {
                window = new MainWindow(root, icon);
                window.FormClosing += OnWindowClosing;
                window.Show();
            }
            if (window.WindowState == FormWindowState.Minimized) window.WindowState = FormWindowState.Normal;
            window.Visible = true;
            window.Activate();
            if (pendingLink != null) { window.OpenLink(pendingLink); pendingLink = null; }
        }

        // Pencereyi kapatmak uygulamayı kapatmaz: tepsiye iner (bildirimler sürsün diye). Windows kapanırken gerçekten kapanır.
        void OnWindowClosing(object sender, FormClosingEventArgs e)
        {
            if (exiting) return;
            if (e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.TaskManagerClosing) { Exit(); return; }
            e.Cancel = true;
            window.Hide();
            if (!hintShown)
            {
                hintShown = true;
                tray.ShowBalloonTip(4000, "Ortam Sade arka planda çalışıyor", "Bildirimler gelmeye devam eder. Açmak için tepsideki simgeye, kapatmak için sağ tıklayıp Kapat'a bas.", ToolTipIcon.Info);
            }
        }

        // ---------- sunucu ----------
        void StartServer()
        {
            if (Program.PortOpen()) return;          // zaten çalışıyor (ör. geliştirme sunucusu): ona bağlanılır
            string node = Path.Combine(root, "runtime", "node.exe");
            if (!File.Exists(node)) node = "node";
            var psi = new ProcessStartInfo(node, "server\\start.mjs")
            {
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
            };
            psi.EnvironmentVariables["ORTAM_MASAUSTU"] = "1";
            psi.EnvironmentVariables.Remove("ORTAM_AC");
            try
            {
                Directory.CreateDirectory(Path.Combine(root, ".cache"));
                var log = Path.Combine(root, ".cache", "sunucu.log");
                try { if (File.Exists(log) && new FileInfo(log).Length > 2_000_000) File.Delete(log); } catch { }
                var w = new StreamWriter(log, true, new UTF8Encoding(false)) { AutoFlush = true };
                w.WriteLine($"---- {DateTime.Now:yyyy-MM-dd HH:mm:ss} başlatıldı");
                server = new Process { StartInfo = psi, EnableRaisingEvents = true };
                server.OutputDataReceived += (s, e) => { if (e.Data != null) lock (w) w.WriteLine(e.Data); };
                server.ErrorDataReceived += (s, e) => { if (e.Data != null) lock (w) w.WriteLine(e.Data); };
                server.Exited += (s, e) => Post(() => OnServerExit(w));
                server.Start();
                server.BeginOutputReadLine();
                server.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Uygulamanın sunucusu başlatılamadı: " + ex.Message, "Ortam Sade", MessageBoxButtons.OK, MessageBoxIcon.Error);
                ExitThread();
            }
        }

        // Sunucu kapandı: Hesap'taki "Uygulamayı kapat" ya da bir hata. Pencere de kapanır.
        void OnServerExit(StreamWriter w)
        {
            if (exiting) return;
            int code = -1;
            try { code = server.ExitCode; } catch { }
            try { lock (w) { w.WriteLine($"---- {DateTime.Now:HH:mm:ss} sunucu kapandı ({code})"); w.Dispose(); } } catch { }
            if (code != 0 && !Program.PortOpen())
                MessageBox.Show("Uygulamanın sunucusu beklenmedik şekilde kapandı. Ayrıntılar: .cache\\sunucu.log", "Ortam Sade", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            Exit(false);
        }

        void Exit(bool stopServer = true)
        {
            if (exiting) return;
            exiting = true;
            tray.Visible = false;
            if (window != null && !window.IsDisposed) { window.Hide(); window.Dispose(); }
            if (stopServer && server != null && !server.HasExited)
            {
                // Önce düzgün kapatma (kayıtlar yazılsın), olmazsa süreç ağacı sonlandırılır
                try
                {
                    using (var h = new HttpClient { Timeout = TimeSpan.FromSeconds(2) })
                        h.PostAsync(Program.Url + "api/shutdown", new StringContent("{}", Encoding.UTF8, "application/json")).Wait(2500);
                }
                catch { }
                if (!server.WaitForExit(4000)) KillTree(server.Id);
            }
            ExitThread();
        }

        static void KillTree(int pid)
        {
            try
            {
                using (var p = Process.Start(new ProcessStartInfo("taskkill.exe", $"/PID {pid} /T /F") { CreateNoWindow = true, UseShellExecute = false }))
                    p?.WaitForExit(5000);
            }
            catch { }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) { tray.Dispose(); ui.Dispose(); }
            base.Dispose(disposing);
        }
    }

    // Ana pencere: arayüz WebView2'de. Uygulamanın kendi adresi dışındaki bağlantılar varsayılan tarayıcıda açılır.
    sealed class MainWindow : Form
    {
        readonly string root;
        readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill };
        readonly Label wait = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Text = "Ortam Sade açılıyor…" };
        string boundsFile => Path.Combine(root, ".cache", "pencere.txt");
        string pendingHash;

        public MainWindow(string root, Icon icon)
        {
            this.root = root;
            Text = "Ortam Sade";
            Icon = icon;
            MinimumSize = new Size(420, 520);
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1320, 880);
            LoadBounds();                         // "Önceki boyut"a dönülünce kullanılacak konum ve boyut
            WindowState = FormWindowState.Maximized;   // her açılışta ekranı kaplar
            bool dark = SystemDark();
            BackColor = dark ? Color.FromArgb(18, 20, 24) : Color.FromArgb(244, 245, 247);
            wait.ForeColor = dark ? Color.Gainsboro : Color.DimGray;
            wait.Font = new Font("Segoe UI", 11f);
            web.DefaultBackgroundColor = BackColor;
            Controls.Add(web);
            Controls.Add(wait);
            wait.BringToFront();
            HandleCreated += (s, e) => DarkTitleBar(dark);
            Shown += async (s, e) => await Init();
            FormClosing += (s, e) => SaveBounds();
        }

        async Task Init()
        {
            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, ".cache", "webview2"));
                await web.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                wait.Text = "Görüntüleyici (Microsoft Edge WebView2) başlatılamadı.\n" + ex.Message +
                    "\n\nWebView2'yi Microsoft'un sitesinden kurup uygulamayı yeniden açın.";
                return;
            }
            var core = web.CoreWebView2;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.DocumentTitleChanged += (s, e) => Text = string.IsNullOrWhiteSpace(core.DocumentTitle) ? "Ortam Sade" : core.DocumentTitle;
            core.NewWindowRequested += (s, e) => { e.Handled = true; OpenExternal(e.Uri); };
            core.NavigationStarting += (s, e) =>
            {
                if (IsOwn(e.Uri)) return;
                e.Cancel = true;
                OpenExternal(e.Uri);
            };
            core.NavigationCompleted += (s, e) => { if (e.IsSuccess) wait.Visible = false; };
            // Sunucu hazır olana kadar beklenir (ilk açılışta birkaç saniye sürebilir)
            for (int i = 0; i < 240 && !Program.PortOpen(); i++) await Task.Delay(250);
            core.Navigate(Program.Url + (pendingHash ?? ""));
            pendingHash = null;
        }

        static bool IsOwn(string uri) =>
            Uri.TryCreate(uri, UriKind.Absolute, out var u) && (u.Scheme == "http" && (u.Host == "localhost" || u.Host == "127.0.0.1") && u.Port == Program.Port
                || u.Scheme == "about" || u.Scheme == "data" || u.Scheme == "blob");

        static void OpenExternal(string uri)
        {
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var u) || !(u.Scheme == "http" || u.Scheme == "https" || u.Scheme == "mailto")) return;
            try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); } catch { }
        }

        // "ortamsade:#/donem/derslerim/..." → o sayfa
        public void OpenLink(string link)
        {
            var hash = link.Substring("ortamsade:".Length);
            int i = hash.IndexOf('#');
            hash = i >= 0 ? hash.Substring(i) : "";
            if (!hash.StartsWith("#/")) return;
            if (web.CoreWebView2 == null) { pendingHash = hash; return; }
            _ = web.CoreWebView2.ExecuteScriptAsync("location.hash=" + Json(hash));
        }
        static string Json(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "") + "\"";

        // ---------- pencere konumu ve görünüm ----------
        void LoadBounds()
        {
            try
            {
                var p = File.ReadAllText(boundsFile).Split(',').Select(int.Parse).ToArray();
                var r = new Rectangle(p[0], p[1], p[2], p[3]);
                if (Screen.AllScreens.Any(sc => sc.WorkingArea.IntersectsWith(r)) && r.Width >= 420 && r.Height >= 520)
                {
                    StartPosition = FormStartPosition.Manual;
                    Bounds = r;
                    if (p.Length > 4 && p[4] == 1) WindowState = FormWindowState.Maximized;
                }
            }
            catch { }
        }
        void SaveBounds()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                File.WriteAllText(boundsFile, $"{r.X},{r.Y},{r.Width},{r.Height},{(WindowState == FormWindowState.Maximized ? 1 : 0)}");
            }
            catch { }
        }
        protected override void OnVisibleChanged(EventArgs e) { if (!Visible) SaveBounds(); base.OnVisibleChanged(e); }

        static bool SystemDark()
        {
            try { return (int)(Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")?.GetValue("AppsUseLightTheme") ?? 1) == 0; }
            catch { return false; }
        }
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        void DarkTitleBar(bool dark) { try { int v = dark ? 1 : 0; DwmSetWindowAttribute(Handle, 20, ref v, 4); } catch { } }
    }
}
