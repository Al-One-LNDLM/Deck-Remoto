#Requires AutoHotkey v2.0

if A_Args.Length >= 2 && A_Args[1] = "--volume" {
  vol := Integer(A_Args[2])
  if (vol < 0) {
    vol := 0
  }
  if (vol > 100) {
    vol := 100
  }

  SoundSetVolume vol
  ExitApp 0
}

if A_Args.Length >= 4 && A_Args[1] = "--text" {
  mode := Trim(A_Args[2])
  enterFlag := Trim(A_Args[3])
  txt := A_Args[4]

  if mode = "paste" {
    A_Clipboard := txt
    Sleep 30
    Send "^v"
  } else if mode = "type" {
    SendText txt
  } else {
    ExitApp 1
  }

  if enterFlag = "1" {
    Sleep 40
    Send "{Enter}"
  }

  ExitApp 0
}

if A_Args.Length >= 2 && A_Args[1] = "--special" {
  key := Trim(A_Args[2])
  if key = "" {
    ExitApp 1
  }

  allowed := Map(
    "Volume_Up", true,
    "Volume_Down", true,
    "Volume_Mute", true,
    "Media_Play_Pause", true,
    "Media_Next", true,
    "Media_Prev", true
  )

  if !allowed.Has(key) {
    ExitApp 1
  }

  SendInput "{" key "}"
  ExitApp 0
}

if A_Args.Length < 1 {
  ExitApp 1
}

hk := Trim(A_Args[1])
if hk = "" {
  ExitApp 1
}

ConvertHotkeyToAhk(hotkey) {
  parts := StrSplit(hotkey, "+")
  if parts.Length = 0 {
    return ""
  }

  mods := ""
  loop parts.Length - 1 {
    token := StrLower(Trim(parts[A_Index]))
    switch token {
      case "ctrl", "control":
        mods .= "^"
      case "alt":
        mods .= "!"
      case "shift":
        mods .= "+"
      case "win", "windows":
        mods .= "#"
    }
  }

  finalKey := ConvertFinalKey(Trim(parts[parts.Length]))
  return mods . finalKey
}

ConvertFinalKey(key) {
  lowerKey := StrLower(key)

  if RegExMatch(lowerKey, "^[a-z]$") {
    return lowerKey
  }

  switch lowerKey {
    case "enter", "return":
      return "{Enter}"
    case "tab":
      return "{Tab}"
    case "space", "spacebar":
      return "{Space}"
    case "up", "arrowup":
      return "{Up}"
    case "down", "arrowdown":
      return "{Down}"
    case "left", "arrowleft":
      return "{Left}"
    case "right", "arrowright":
      return "{Right}"
    case "esc", "escape":
      return "{Esc}"
    case "backspace":
      return "{Backspace}"
    case "delete", "del":
      return "{Delete}"
    case "insert", "ins":
      return "{Insert}"
    case "home":
      return "{Home}"
    case "end":
      return "{End}"
    case "pgup", "pageup":
      return "{PgUp}"
    case "pgdn", "pagedown":
      return "{PgDn}"
  }

  if RegExMatch(lowerKey, "^f([1-9]|1[0-2])$") {
    return "{" . StrUpper(lowerKey) . "}"
  }

  if RegExMatch(lowerKey, "^[0-9]$") {
    return lowerKey
  }

  return "{" . key . "}"
}

combo := ConvertHotkeyToAhk(hk)
if combo = "" {
  ExitApp 1
}

savedCaps := GetKeyState("CapsLock", "T")
savedNum := GetKeyState("NumLock", "T")
savedScr := GetKeyState("ScrollLock", "T")

SendInput "{Blind}" . combo

if (GetKeyState("CapsLock", "T") != savedCaps) {
  SetCapsLockState(savedCaps ? "On" : "Off")
}
if (GetKeyState("NumLock", "T") != savedNum) {
  SetNumLockState(savedNum ? "On" : "Off")
}
if (GetKeyState("ScrollLock", "T") != savedScr) {
  SetScrollLockState(savedScr ? "On" : "Off")
}

ExitApp 0
