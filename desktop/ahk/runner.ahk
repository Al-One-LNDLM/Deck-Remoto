#Requires AutoHotkey v2.0

if A_Args.Length < 1 {
  ExitApp 1
}

hotkey := A_Args[1]
if hotkey = "" {
  ExitApp 1
}

ahkHotkey := hotkey
ahkHotkey := StrReplace(ahkHotkey, "Ctrl", "^")
ahkHotkey := StrReplace(ahkHotkey, "Alt", "!")
ahkHotkey := StrReplace(ahkHotkey, "Shift", "+")
ahkHotkey := StrReplace(ahkHotkey, "Win", "#")

Send ahkHotkey
ExitApp 0
