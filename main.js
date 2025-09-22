// main.js (Electron MAIN)
const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let win;
let isWallpaperMode = false;

/** РАЗРЕШЕНИЕ ПУТИ К index.html
 *  - В dev: берём <repo_root>/index.html
 *  - В prod (упаковано): кладём index.html рядом с main.js в asar (или в resources) и берём из process.resourcesPath
 */
function resolveIndexHtml() {
  // Dev-путь (запуск `electron .` из корня)
  const devHtml = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(devHtml)) return devHtml;

  // Prod-путь (упаковано)
  const prodHtml1 = path.join(__dirname, 'index.html');                 // если упакован рядом с main.js
  const prodHtml2 = path.join(process.resourcesPath, 'index.html');     // если вынесен в resources
  if (fs.existsSync(prodHtml1)) return prodHtml1;
  if (fs.existsSync(prodHtml2)) return prodHtml2;

  throw new Error('index.html не найден. Убедись, что он включён в сборку.');
}

/** Конвертирует HWND (Buffer) в 64-битное число для PowerShell */
function hwndToNumber(buf) {
  if (buf.length >= 8) {
    const lo = buf.readUInt32LE(0);
    const hi = buf.readUInt32LE(4);
    return BigInt(hi) << 32n | BigInt(lo);
  } else {
    return BigInt(buf.readUInt32LE(0));
  }
}

/** PowerShell: прикрепить окно к WorkerW (живые обои) */
const PS_ATTACH = `
Add-Type -Namespace P -Name Win -MemberDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Win {
  [DllImport("user32.dll", CharSet=CharSet.Auto)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll", CharSet=CharSet.Auto)]
  public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
  [DllImport("user32.dll")]
  public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern uint SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
$prog = [P.Win]::FindWindow("Progman", $null)
if ($prog -ne [IntPtr]::Zero) {
  $out = [IntPtr]::Zero
  [void][P.Win]::SendMessageTimeout($prog, 0x052C, [UIntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$out)
}
$workerw = [IntPtr]::Zero
$cur = [P.Win]::FindWindowEx([IntPtr]::Zero, [IntPtr]::Zero, "WorkerW", $null)
while ($cur -ne [IntPtr]::Zero) {
  $def = [P.Win]::FindWindowEx($cur, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
  if ($def -ne [IntPtr]::Zero) {
    $workerw = [P.Win]::FindWindowEx([IntPtr]::Zero, $cur, "WorkerW", $null)
    break
  }
  $cur = [P.Win]::FindWindowEx([IntPtr]::Zero, $cur, "WorkerW", $null)
}
if ($workerw -eq [IntPtr]::Zero) { Write-Error "WorkerW not found"; exit 2 }
$child = [IntPtr]::new([UInt64]::Parse($args[0]))
$res = [P.Win]::SetParent($child, $workerw)
if ($res -eq [IntPtr]::Zero) { Write-Error "SetParent failed"; exit 3 }
`;

const PS_DETACH = `
Add-Type -Namespace P -Name Win -MemberDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Win {
  [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
}
"@
$child = [IntPtr]::new([UInt64]::Parse($args[0]))
$desk = [P.Win]::GetDesktopWindow()
$res = [P.Win]::SetParent($child, $desk)
if ($res -eq [IntPtr]::Zero) { Write-Error "SetParent failed"; exit 3 }
`;

function runPS(script, arg) {
  const r = spawnSync('powershell.exe', [
    '-NoProfile','-ExecutionPolicy','Bypass','-Command', script, '--', String(arg)
  ], { encoding: 'utf8' });
  return r;
}

function tryAttachToWallpaper(win) {
  if (process.platform !== 'win32') return false;
  try {
    const hwndNum = hwndToNumber(win.getNativeWindowHandle());
    const r = runPS(PS_ATTACH, hwndNum);
    return r.status === 0;
  } catch {
    return false;
  }
}
function detachFromWallpaper(win) {
  if (process.platform !== 'win32') return;
  try {
    const hwndNum = hwndToNumber(win.getNativeWindowHandle());
    runPS(PS_DETACH, hwndNum);
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    show: false,
    frame: false,
    fullscreen: true,
    resizable: false,
    backgroundColor: '#201711',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    }
  });

  const htmlPath = resolveIndexHtml();
  win.loadFile(htmlPath);

  win.once('ready-to-show', () => {
    if (tryAttachToWallpaper(win)) {
      isWallpaperMode = true;
      win.showInactive(); // не красть фокус у рабочего стола
    } else {
      isWallpaperMode = false;
      win.show(); // как обычное окно
    }
  });

  app.whenReady().then(() => {
    // перезагрузка содержимого
    globalShortcut.register('Ctrl+R', () => { try { win.webContents.reload(); } catch {} });

    // переключение Wallpaper/Window
    globalShortcut.register('Ctrl+Alt+W', () => {
      try {
        if (isWallpaperMode) {
          detachFromWallpaper(win);
          isWallpaperMode = false;
          win.show();
        } else {
          if (tryAttachToWallpaper(win)) {
            isWallpaperMode = true;
            win.showInactive();
          }
        }
      } catch (e) {
        dialog.showErrorBox('Toggle wallpaper mode', String(e));
      }
    });
  });
}

app.whenReady().then(() => {
  try { createWindow(); }
  catch (e) { dialog.showErrorBox('Инициализация не удалась', String(e)); app.quit(); }
});

app.on('window-all-closed', () => app.quit());
