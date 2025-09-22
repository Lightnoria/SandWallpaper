// main.js
const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_DIR   = path.join(app.getPath('appData'), 'SandWallpaper');
const USER_HTML = path.join(APP_DIR, 'index.html');
const ASSET_HTML = path.join(__dirname, 'assets', 'index.html');

let win;
let isWallpaperMode = false;

function ensureUserHtml() {
  if (!fs.existsSync(ASSET_HTML)) throw new Error(`Нет шаблона ${ASSET_HTML}`);
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

  const asset = fs.readFileSync(ASSET_HTML, 'utf8');
  const m = asset.match(/SW_VERSION:\s*([^\s>]+)/);
  const assetVer = m ? m[1] : 'unknown';

  let needCopy = false;
  if (!fs.existsSync(USER_HTML)) {
    needCopy = true;
  } else {
    const user = fs.readFileSync(USER_HTML, 'utf8');
    const mu = user.match(/SW_VERSION:\s*([^\s>]+)/);
    const userVer = mu ? mu[1] : 'none';
    if (userVer !== assetVer) needCopy = true; // версия изменилась → обновляем
  }
  if (needCopy) fs.writeFileSync(USER_HTML, asset);
}


function hwndToNumber(buf) {
  // Electron даёт HWND как Buffer (8 байт на x64)
  // Преобразуем в строку для PowerShell (unsigned long long)
  if (buf.length >= 8) {
    const lo = buf.readUInt32LE(0);
    const hi = buf.readUInt32LE(4);
    return BigInt(hi) << 32n | BigInt(lo);
  } else {
    return BigInt(buf.readUInt32LE(0));
  }
}

// PowerShell-скрипт, который:
// 1) просит Progman создать WorkerW (SendMessageTimeout 0x052C)
// 2) находит WorkerW (через поиск SHELLDLL_DefView)
// 3) SetParent(hwnd, workerw)
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
  const hwndNum = hwndToNumber(win.getNativeWindowHandle());
  const r = runPS(PS_ATTACH, hwndNum);
  if (r.status === 0) return true;
  // Если не вышло — можно посмотреть r.stderr для отладки
  return false;
}
function detachFromWallpaper(win) {
  if (process.platform !== 'win32') return;
  const hwndNum = hwndToNumber(win.getNativeWindowHandle());
  runPS(PS_DETACH, hwndNum);
}

function createWindow() {
  win = new BrowserWindow({
    show: false,
    frame: false,
    fullscreen: true,
    resizable: false,
    backgroundColor: '#201711',
    webPreferences: { contextIsolation: true, sandbox: true }
  });

  win.loadFile(USER_HTML);
  win.once('ready-to-show', () => {
    if (tryAttachToWallpaper(win)) {
      isWallpaperMode = true;
      win.showInactive();
    } else {
      isWallpaperMode = false;
      win.show(); // fallback как обычное окно
    }
  });

  app.whenReady().then(() => {
    globalShortcut.register('Ctrl+R', () => win.webContents.reload());
    globalShortcut.register('Ctrl+Shift+R', () => {
      try { fs.copyFileSync(ASSET_HTML, USER_HTML); win.loadFile(USER_HTML); }
      catch (e) { dialog.showErrorBox('Ошибка восстановления', String(e)); }
    });
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
  try { ensureUserHtml(); createWindow(); }
  catch (e) { dialog.showErrorBox('Инициализация не удалась', String(e)); app.quit(); }
});
app.on('window-all-closed', () => app.quit());
