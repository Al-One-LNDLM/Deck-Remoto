#Requires AutoHotkey v2.0

if A_Args.Length < 1 {
  ExitApp 1
}

hk := A_Args.Length >= 1 ? A_Args[1] : ""
if hk = "" {
  ExitApp 1
}

ahkHotkey := hk
ahkHotkey := StrReplace(ahkHotkey, "Ctrl", "^")
ahkHotkey := StrReplace(ahkHotkey, "Alt", "!")
ahkHotkey := StrReplace(ahkHotkey, "Shift", "+")
ahkHotkey := StrReplace(ahkHotkey, "Win", "#")

Send ahkHotkey
ExitApp 0
