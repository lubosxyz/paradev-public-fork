const L$1 = (chord) => ({
  version: 2,
  mode: "logical",
  chord
});
const HOTKEYS_REGISTRY = {
  // Navigation
  NAVIGATE_BACK: {
    key: {
      mac: L$1("meta+bracketleft"),
      windows: L$1("ctrl+shift+bracketleft"),
      linux: L$1("ctrl+shift+bracketleft")
    },
    label: (
      /** i18n */
      {
        id: "cCNx1s"
      }
    ),
    category: "Navigation",
    description: (
      /** i18n */
      {
        id: "fsk8JI"
      }
    )
  },
  NAVIGATE_FORWARD: {
    key: {
      mac: L$1("meta+bracketright"),
      windows: L$1("ctrl+shift+bracketright"),
      linux: L$1("ctrl+shift+bracketright")
    },
    label: (
      /** i18n */
      {
        id: "-Lhs2K"
      }
    ),
    category: "Navigation",
    description: (
      /** i18n */
      {
        id: "IonugP"
      }
    )
  },
  QUICK_OPEN: {
    key: {
      mac: L$1("meta+p"),
      windows: L$1("ctrl+shift+p"),
      linux: L$1("ctrl+shift+p")
    },
    label: (
      /** i18n */
      {
        id: "X6aTb-"
      }
    ),
    category: "Navigation",
    description: (
      /** i18n */
      {
        id: "1-LNUq"
      }
    )
  },
  // Workspace switching
  JUMP_TO_WORKSPACE_1: {
    key: {
      mac: L$1("meta+1"),
      windows: L$1("ctrl+shift+1"),
      linux: L$1("ctrl+shift+1")
    },
    label: (
      /** i18n */
      {
        id: "q-Wzvm"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_2: {
    key: {
      mac: L$1("meta+2"),
      windows: L$1("ctrl+shift+2"),
      linux: L$1("ctrl+shift+2")
    },
    label: (
      /** i18n */
      {
        id: "wHkOY0"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_3: {
    key: {
      mac: L$1("meta+3"),
      windows: L$1("ctrl+shift+3"),
      linux: L$1("ctrl+shift+3")
    },
    label: (
      /** i18n */
      {
        id: "wDnxUK"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_4: {
    key: {
      mac: L$1("meta+4"),
      windows: L$1("ctrl+shift+4"),
      linux: L$1("ctrl+shift+4")
    },
    label: (
      /** i18n */
      {
        id: "Qlv3-m"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_5: {
    key: {
      mac: L$1("meta+5"),
      windows: L$1("ctrl+shift+5"),
      linux: L$1("ctrl+shift+5")
    },
    label: (
      /** i18n */
      {
        id: "sp4Qqc"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_6: {
    key: {
      mac: L$1("meta+6"),
      windows: L$1("ctrl+shift+6"),
      linux: L$1("ctrl+shift+6")
    },
    label: (
      /** i18n */
      {
        id: "VD8fdM"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_7: {
    key: {
      mac: L$1("meta+7"),
      windows: L$1("ctrl+shift+7"),
      linux: L$1("ctrl+shift+7")
    },
    label: (
      /** i18n */
      {
        id: "WS3Qox"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_8: {
    key: {
      mac: L$1("meta+8"),
      windows: L$1("ctrl+shift+8"),
      linux: L$1("ctrl+shift+8")
    },
    label: (
      /** i18n */
      {
        id: "Y42fIJ"
      }
    ),
    category: "Workspace"
  },
  JUMP_TO_WORKSPACE_9: {
    key: {
      mac: L$1("meta+9"),
      windows: L$1("ctrl+shift+9"),
      linux: L$1("ctrl+shift+9")
    },
    label: (
      /** i18n */
      {
        id: "A4mEO9"
      }
    ),
    category: "Workspace"
  },
  PREV_WORKSPACE: {
    key: {
      mac: "meta+alt+up",
      windows: "ctrl+shift+alt+up",
      linux: "ctrl+shift+alt+up"
    },
    label: (
      /** i18n */
      {
        id: "R5S5e6"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "VBpMPP"
      }
    )
  },
  NEXT_WORKSPACE: {
    key: {
      mac: "meta+alt+down",
      windows: "ctrl+shift+alt+down",
      linux: "ctrl+shift+alt+down"
    },
    label: (
      /** i18n */
      {
        id: "L64pW_"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "yvaihj"
      }
    )
  },
  OPEN_ACTIVE_WORKSPACE_SWITCHER: {
    key: {
      mac: L$1("meta+semicolon"),
      windows: L$1("ctrl+alt+semicolon"),
      linux: L$1("ctrl+alt+semicolon")
    },
    label: (
      /** i18n */
      {
        id: "dsDtzm"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "ocQCqC"
      }
    )
  },
  CLOSE_WORKSPACE: {
    key: {
      mac: "meta+shift+backspace",
      windows: "ctrl+shift+backspace",
      linux: "ctrl+shift+backspace"
    },
    label: (
      /** i18n */
      {
        id: "yXo6bp"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "UG1qs7"
      }
    )
  },
  UNDO: {
    key: {
      mac: L$1("meta+z"),
      windows: L$1("ctrl+z"),
      linux: L$1("ctrl+z")
    },
    label: (
      /** i18n */
      {
        id: "9uI_rE"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "j6Kerz"
      }
    )
  },
  NEW_WORKSPACE: {
    key: {
      mac: L$1("meta+n"),
      windows: L$1("ctrl+shift+n"),
      linux: L$1("ctrl+shift+n")
    },
    label: (
      /** i18n */
      {
        id: "VxFQK8"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "O7N0wn"
      }
    )
  },
  QUICK_CREATE_WORKSPACE: {
    key: {
      mac: L$1("meta+shift+n"),
      windows: L$1("ctrl+shift+alt+n"),
      linux: L$1("ctrl+shift+alt+n")
    },
    label: (
      /** i18n */
      {
        id: "OIp5wV"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "1tH7Le"
      }
    )
  },
  RUN_WORKSPACE_COMMAND: {
    key: {
      mac: L$1("meta+g"),
      windows: L$1("ctrl+shift+g"),
      linux: L$1("ctrl+shift+g")
    },
    label: (
      /** i18n */
      {
        id: "gnAHEP"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "Od-kQV"
      }
    )
  },
  FOCUS_TASK_SEARCH: {
    key: {
      mac: L$1("meta+f"),
      windows: L$1("ctrl+shift+f"),
      linux: L$1("ctrl+shift+f")
    },
    label: (
      /** i18n */
      {
        id: "2mIKKJ"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "cdImJl"
      }
    )
  },
  OPEN_PROJECT: {
    key: {
      mac: L$1("meta+shift+o"),
      windows: L$1("ctrl+shift+alt+o"),
      linux: L$1("ctrl+shift+alt+o")
    },
    label: (
      /** i18n */
      {
        id: "y5ufpc"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "0sOHDK"
      }
    )
  },
  OPEN_PR: {
    key: {
      mac: L$1("meta+shift+p"),
      windows: L$1("ctrl+shift+alt+p"),
      linux: L$1("ctrl+shift+alt+p")
    },
    label: (
      /** i18n */
      {
        id: "GJW_68"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "J-sdHQ"
      }
    )
  },
  // Layout
  TOGGLE_SIDEBAR: {
    key: {
      mac: L$1("meta+l"),
      windows: L$1("ctrl+shift+l"),
      linux: L$1("ctrl+shift+l")
    },
    label: (
      /** i18n */
      {
        id: "y4FDpk"
      }
    ),
    category: "Layout"
  },
  TOGGLE_RIGHT_PANE_FULL_SCREEN: {
    key: {
      mac: L$1("meta+shift+l"),
      windows: L$1("ctrl+shift+alt+l"),
      linux: L$1("ctrl+shift+alt+l")
    },
    label: (
      /** i18n */
      {
        id: "uyRzRX"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "q092Wa"
      }
    )
  },
  OPEN_DIFF_VIEWER: {
    key: {
      mac: L$1("meta+shift+g"),
      windows: L$1("ctrl+shift+alt+g"),
      linux: L$1("ctrl+shift+alt+g")
    },
    label: (
      /** i18n */
      {
        id: "XZQPGF"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "ESt4cM"
      }
    )
  },
  TOGGLE_WORKSPACE_SIDEBAR: {
    key: {
      mac: L$1("meta+b"),
      windows: L$1("ctrl+shift+b"),
      linux: L$1("ctrl+shift+b")
    },
    label: (
      /** i18n */
      {
        id: "K3_kMw"
      }
    ),
    category: "Layout"
  },
  SPLIT_RIGHT: {
    key: {
      mac: L$1("meta+d"),
      windows: L$1("ctrl+shift+d"),
      linux: L$1("ctrl+shift+d")
    },
    label: (
      /** i18n */
      {
        id: "xdfhQ3"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "y1UXud"
      }
    )
  },
  SPLIT_DOWN: {
    key: {
      mac: L$1("meta+shift+d"),
      windows: L$1("ctrl+shift+alt+d"),
      linux: L$1("ctrl+shift+alt+d")
    },
    label: (
      /** i18n */
      {
        id: "ftSWNu"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "pQYgHZ"
      }
    )
  },
  SPLIT_AUTO: {
    key: {
      mac: L$1("meta+e"),
      windows: L$1("ctrl+shift+e"),
      linux: L$1("ctrl+shift+e")
    },
    label: (
      /** i18n */
      {
        id: "Vje2FX"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "wy5_dv"
      }
    )
  },
  SPLIT_WITH_BROWSER: {
    key: {
      mac: L$1("meta+shift+s"),
      windows: L$1("ctrl+shift+alt+s"),
      linux: L$1("ctrl+shift+alt+s")
    },
    label: (
      /** i18n */
      {
        id: "lNjzY9"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "5HLRv3"
      }
    )
  },
  SPLIT_WITH_DESKTOP: {
    key: {
      mac: L$1("meta+shift+y"),
      windows: L$1("ctrl+shift+alt+y"),
      linux: L$1("ctrl+shift+alt+y")
    },
    label: (
      /** i18n */
      {
        id: "rQqaFT"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "XSMqMU"
      }
    )
  },
  SPLIT_WITH_MOBILE: {
    key: {
      mac: L$1("meta+shift+m"),
      windows: L$1("ctrl+shift+alt+m"),
      linux: L$1("ctrl+shift+alt+m")
    },
    label: (
      /** i18n */
      {
        id: "JKi0WT"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "8Zci4i"
      }
    )
  },
  EQUALIZE_PANE_SPLITS: {
    key: {
      mac: L$1("meta+shift+0"),
      windows: L$1("ctrl+shift+0"),
      linux: L$1("ctrl+shift+0")
    },
    label: (
      /** i18n */
      {
        id: "Kof-vP"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "6M5w6F"
      }
    )
  },
  CLOSE_PANE: {
    key: {
      mac: L$1("meta+w"),
      windows: L$1("ctrl+shift+w"),
      linux: L$1("ctrl+shift+w")
    },
    label: (
      /** i18n */
      {
        id: "wwAG5w"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "_7Xb_N"
      }
    )
  },
  // Terminal
  FIND_IN_TERMINAL: {
    key: {
      mac: L$1("meta+f"),
      windows: L$1("ctrl+shift+f"),
      linux: L$1("ctrl+shift+f")
    },
    label: (
      /** i18n */
      {
        id: "HfUXiA"
      }
    ),
    category: "Terminal",
    description: (
      /** i18n */
      {
        id: "e9xstv"
      }
    )
  },
  TOGGLE_TERMINAL_RICH_INPUT: {
    key: {
      mac: L$1("meta+i"),
      // Ctrl+Shift+I is the Electron devtools accelerator; use +M instead.
      windows: L$1("ctrl+shift+m"),
      linux: L$1("ctrl+shift+m")
    },
    label: (
      /** i18n */
      {
        id: "Z81jOq"
      }
    ),
    category: "Terminal",
    description: (
      /** i18n */
      {
        id: "62iwJ8"
      }
    )
  },
  FIND_IN_FILE_VIEWER: {
    key: {
      mac: L$1("meta+f"),
      windows: L$1("ctrl+shift+f"),
      linux: L$1("ctrl+shift+f")
    },
    label: (
      /** i18n */
      {
        id: "pZKOzG"
      }
    ),
    category: "Navigation",
    description: (
      /** i18n */
      {
        id: "PCv0Uq"
      }
    )
  },
  FIND_IN_CHAT: {
    key: {
      mac: L$1("meta+f"),
      windows: L$1("ctrl+shift+f"),
      linux: L$1("ctrl+shift+f")
    },
    label: (
      /** i18n */
      {
        id: "KDjYDd"
      }
    ),
    category: "Chat",
    description: (
      /** i18n */
      {
        id: "LUPeT5"
      }
    )
  },
  FIND_IN_CHANGES: {
    key: {
      mac: L$1("meta+f"),
      windows: L$1("ctrl+shift+f"),
      linux: L$1("ctrl+shift+f")
    },
    label: (
      /** i18n */
      {
        id: "LPKGDe"
      }
    ),
    category: "Navigation",
    description: (
      /** i18n */
      {
        id: "d8ErXT"
      }
    )
  },
  NEW_GROUP: {
    key: {
      mac: L$1("meta+t"),
      windows: L$1("ctrl+shift+t"),
      linux: L$1("ctrl+shift+t")
    },
    label: (
      /** i18n */
      {
        id: "ZBxvV3"
      }
    ),
    category: "Terminal"
  },
  REOPEN_TAB: {
    key: {
      mac: L$1("meta+shift+r"),
      windows: L$1("ctrl+shift+alt+r"),
      linux: L$1("ctrl+shift+alt+r")
    },
    label: (
      /** i18n */
      {
        id: "3a2uQp"
      }
    ),
    category: "Layout"
  },
  NEW_BROWSER: {
    key: {
      mac: L$1("meta+shift+b"),
      windows: L$1("ctrl+shift+alt+b"),
      linux: L$1("ctrl+shift+alt+b")
    },
    label: (
      /** i18n */
      {
        id: "FD-YZ9"
      }
    ),
    category: "Layout"
  },
  CLOSE_TERMINAL: {
    key: {
      mac: L$1("meta+w"),
      windows: L$1("ctrl+shift+w"),
      linux: L$1("ctrl+shift+w")
    },
    label: (
      /** i18n */
      {
        id: "6cuOnR"
      }
    ),
    category: "Terminal"
  },
  CLOSE_TAB: {
    key: {
      mac: L$1("meta+shift+w"),
      windows: L$1("ctrl+shift+alt+w"),
      linux: L$1("ctrl+shift+alt+w")
    },
    label: (
      /** i18n */
      {
        id: "t2TMzs"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "5JvUkd"
      }
    )
  },
  CLEAR_TERMINAL: {
    key: {
      mac: L$1("meta+k"),
      windows: L$1("ctrl+shift+k"),
      linux: L$1("ctrl+shift+k")
    },
    label: (
      /** i18n */
      {
        id: "-ZH0Oj"
      }
    ),
    category: "Terminal"
  },
  SCROLL_TO_BOTTOM: {
    key: {
      mac: "meta+shift+down",
      windows: "ctrl+end",
      linux: "ctrl+end"
    },
    label: (
      /** i18n */
      {
        id: "01v_wo"
      }
    ),
    category: "Terminal",
    description: (
      /** i18n */
      {
        id: "7hb0iP"
      }
    )
  },
  PREV_TAB_ALT: {
    key: {
      mac: "ctrl+shift+tab",
      windows: "ctrl+shift+tab",
      linux: "ctrl+shift+tab"
    },
    label: (
      /** i18n */
      {
        id: "wzjlCC"
      }
    ),
    category: "Layout"
  },
  NEXT_TAB_ALT: {
    key: {
      mac: "ctrl+tab",
      windows: "ctrl+tab",
      linux: "ctrl+tab"
    },
    label: (
      /** i18n */
      {
        id: "dpAWmC"
      }
    ),
    category: "Layout"
  },
  PREV_TAB: {
    key: {
      mac: "meta+alt+left",
      windows: "ctrl+shift+alt+left",
      linux: "ctrl+shift+alt+left"
    },
    label: (
      /** i18n */
      {
        id: "zUng18"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "wDWiXA"
      }
    )
  },
  NEXT_TAB: {
    key: {
      mac: "meta+alt+right",
      windows: "ctrl+shift+alt+right",
      linux: "ctrl+shift+alt+right"
    },
    label: (
      /** i18n */
      {
        id: "ykoijS"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "5ZNBcg"
      }
    )
  },
  PREV_RIGHT_SIDEBAR_TAB: {
    key: {
      mac: "meta+ctrl+left",
      windows: "ctrl+shift+alt+pageup",
      linux: "ctrl+shift+alt+pageup"
    },
    label: (
      /** i18n */
      {
        id: "OVR3W5"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "0p05vn"
      }
    )
  },
  NEXT_RIGHT_SIDEBAR_TAB: {
    key: {
      mac: "meta+ctrl+right",
      windows: "ctrl+shift+alt+pagedown",
      linux: "ctrl+shift+alt+pagedown"
    },
    label: (
      /** i18n */
      {
        id: "jlfB87"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "ob-7-u"
      }
    )
  },
  TOGGLE_RIGHT_SIDEBAR_FOCUS: {
    key: {
      mac: L$1("meta+alt+l"),
      windows: L$1("ctrl+shift+alt+e"),
      linux: L$1("ctrl+shift+alt+e")
    },
    label: (
      /** i18n */
      {
        id: "5RcevH"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "cWCgBg"
      }
    )
  },
  FOCUS_PANE_LEFT: {
    key: {
      mac: null,
      windows: null,
      linux: null
    },
    label: (
      /** i18n */
      {
        id: "Fox7uR"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "2nJ-_x"
      }
    )
  },
  FOCUS_PANE_RIGHT: {
    key: {
      mac: null,
      windows: null,
      linux: null
    },
    label: (
      /** i18n */
      {
        id: "LOKbDw"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "-e85mw"
      }
    )
  },
  FOCUS_PANE_UP: {
    key: {
      mac: null,
      windows: null,
      linux: null
    },
    label: (
      /** i18n */
      {
        id: "CoRY1R"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "8yDuQF"
      }
    )
  },
  FOCUS_PANE_DOWN: {
    key: {
      mac: null,
      windows: null,
      linux: null
    },
    label: (
      /** i18n */
      {
        id: "QVrs2u"
      }
    ),
    category: "Layout",
    description: (
      /** i18n */
      {
        id: "sGQ8iR"
      }
    )
  },
  JUMP_TO_TAB_1: {
    key: {
      mac: L$1("meta+alt+1"),
      windows: L$1("ctrl+shift+alt+1"),
      linux: L$1("ctrl+shift+alt+1")
    },
    label: (
      /** i18n */
      {
        id: "mFxvXy"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_2: {
    key: {
      mac: L$1("meta+alt+2"),
      windows: L$1("ctrl+shift+alt+2"),
      linux: L$1("ctrl+shift+alt+2")
    },
    label: (
      /** i18n */
      {
        id: "KJIrCj"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_3: {
    key: {
      mac: L$1("meta+alt+3"),
      windows: L$1("ctrl+shift+alt+3"),
      linux: L$1("ctrl+shift+alt+3")
    },
    label: (
      /** i18n */
      {
        id: "8V-o8Q"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_4: {
    key: {
      mac: L$1("meta+alt+4"),
      windows: L$1("ctrl+shift+alt+4"),
      linux: L$1("ctrl+shift+alt+4")
    },
    label: (
      /** i18n */
      {
        id: "uo4XCu"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_5: {
    key: {
      mac: L$1("meta+alt+5"),
      windows: L$1("ctrl+shift+alt+5"),
      linux: L$1("ctrl+shift+alt+5")
    },
    label: (
      /** i18n */
      {
        id: "0H81sK"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_6: {
    key: {
      mac: L$1("meta+alt+6"),
      windows: L$1("ctrl+shift+alt+6"),
      linux: L$1("ctrl+shift+alt+6")
    },
    label: (
      /** i18n */
      {
        id: "oI0eoE"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_7: {
    key: {
      mac: L$1("meta+alt+7"),
      windows: L$1("ctrl+shift+alt+7"),
      linux: L$1("ctrl+shift+alt+7")
    },
    label: (
      /** i18n */
      {
        id: "_WeV1v"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_8: {
    key: {
      mac: L$1("meta+alt+8"),
      windows: L$1("ctrl+shift+alt+8"),
      linux: L$1("ctrl+shift+alt+8")
    },
    label: (
      /** i18n */
      {
        id: "pc9HDw"
      }
    ),
    category: "Layout"
  },
  JUMP_TO_TAB_9: {
    key: {
      mac: L$1("meta+alt+9"),
      windows: L$1("ctrl+shift+alt+9"),
      linux: L$1("ctrl+shift+alt+9")
    },
    label: (
      /** i18n */
      {
        id: "7wr_7P"
      }
    ),
    category: "Layout"
  },
  OPEN_PRESET_1: {
    key: {
      mac: L$1("ctrl+1"),
      windows: L$1("ctrl+1"),
      linux: L$1("ctrl+1")
    },
    label: (
      /** i18n */
      {
        id: "VWUnmh"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_2: {
    key: {
      mac: L$1("ctrl+2"),
      windows: L$1("ctrl+2"),
      linux: L$1("ctrl+2")
    },
    label: (
      /** i18n */
      {
        id: "TL6NYO"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_3: {
    key: {
      mac: L$1("ctrl+3"),
      windows: L$1("ctrl+3"),
      linux: L$1("ctrl+3")
    },
    label: (
      /** i18n */
      {
        id: "kCxac5"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_4: {
    key: {
      mac: L$1("ctrl+4"),
      windows: L$1("ctrl+4"),
      linux: L$1("ctrl+4")
    },
    label: (
      /** i18n */
      {
        id: "WA6Ikn"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_5: {
    key: {
      mac: L$1("ctrl+5"),
      windows: L$1("ctrl+5"),
      linux: L$1("ctrl+5")
    },
    label: (
      /** i18n */
      {
        id: "5DVji5"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_6: {
    key: {
      mac: L$1("ctrl+6"),
      windows: L$1("ctrl+6"),
      linux: L$1("ctrl+6")
    },
    label: (
      /** i18n */
      {
        id: "J-AUSc"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_7: {
    key: {
      mac: L$1("ctrl+7"),
      windows: L$1("ctrl+7"),
      linux: L$1("ctrl+7")
    },
    label: (
      /** i18n */
      {
        id: "WYl6C6"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_8: {
    key: {
      mac: L$1("ctrl+8"),
      windows: L$1("ctrl+8"),
      linux: L$1("ctrl+8")
    },
    label: (
      /** i18n */
      {
        id: "9FX7JB"
      }
    ),
    category: "Terminal"
  },
  OPEN_PRESET_9: {
    key: {
      mac: L$1("ctrl+9"),
      windows: L$1("ctrl+9"),
      linux: L$1("ctrl+9")
    },
    label: (
      /** i18n */
      {
        id: "E4_tnp"
      }
    ),
    category: "Terminal"
  },
  // Chat
  FOCUS_CHAT_INPUT: {
    key: {
      mac: L$1("meta+j"),
      windows: L$1("ctrl+shift+j"),
      linux: L$1("ctrl+shift+j")
    },
    label: (
      /** i18n */
      {
        id: "tRCHSh"
      }
    ),
    category: "Chat"
  },
  NEW_CHAT: {
    key: {
      mac: L$1("meta+shift+j"),
      windows: L$1("ctrl+shift+alt+j"),
      linux: L$1("ctrl+shift+alt+j")
    },
    label: (
      /** i18n */
      {
        id: "q2-WzE"
      }
    ),
    category: "Chat"
  },
  CHAT_ADD_ATTACHMENT: {
    key: {
      mac: L$1("meta+u"),
      windows: L$1("ctrl+shift+u"),
      linux: L$1("ctrl+shift+u")
    },
    label: (
      /** i18n */
      {
        id: "Ua7zOO"
      }
    ),
    category: "Chat"
  },
  // Window
  ZOOM_IN: {
    key: {
      mac: L$1("meta+equal"),
      windows: L$1("ctrl+equal"),
      linux: L$1("ctrl+equal")
    },
    label: (
      /** i18n */
      {
        id: "Dz7fsq"
      }
    ),
    category: "Window",
    description: (
      /** i18n */
      {
        id: "MKIr8_"
      }
    )
  },
  ZOOM_OUT: {
    key: {
      mac: L$1("meta+minus"),
      windows: L$1("ctrl+minus"),
      linux: L$1("ctrl+minus")
    },
    label: (
      /** i18n */
      {
        id: "bbJ-VR"
      }
    ),
    category: "Window",
    description: (
      /** i18n */
      {
        id: "MKIr8_"
      }
    )
  },
  ZOOM_RESET: {
    key: {
      mac: L$1("meta+0"),
      windows: L$1("ctrl+0"),
      linux: L$1("ctrl+0")
    },
    label: (
      /** i18n */
      {
        id: "_I8Nws"
      }
    ),
    category: "Window",
    description: (
      /** i18n */
      {
        id: "MKIr8_"
      }
    )
  },
  OPEN_IN_APP: {
    key: {
      mac: L$1("meta+o"),
      windows: L$1("ctrl+shift+o"),
      linux: L$1("ctrl+shift+o")
    },
    label: (
      /** i18n */
      {
        id: "DNTvdl"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "7rSZ4G"
      }
    )
  },
  COPY_PATH: {
    key: {
      mac: L$1("meta+shift+c"),
      windows: L$1("ctrl+shift+alt+c"),
      linux: L$1("ctrl+shift+alt+c")
    },
    label: (
      /** i18n */
      {
        id: "zd00pH"
      }
    ),
    category: "Workspace",
    description: (
      /** i18n */
      {
        id: "tahG7l"
      }
    )
  },
  // Help
  OPEN_SETTINGS: {
    key: {
      mac: L$1("meta+comma"),
      windows: L$1("ctrl+comma"),
      linux: L$1("ctrl+comma")
    },
    label: (
      /** i18n */
      {
        id: "F37c1s"
      }
    ),
    category: "Help"
  },
  SHOW_HOTKEYS: {
    key: {
      mac: L$1("meta+slash"),
      windows: L$1("ctrl+shift+slash"),
      linux: L$1("ctrl+shift+slash")
    },
    label: (
      /** i18n */
      {
        id: "GHVxKd"
      }
    ),
    category: "Help"
  },
  OPEN_COMMAND_PALETTE: {
    key: {
      mac: L$1("meta+shift+k"),
      windows: L$1("ctrl+shift+k"),
      linux: L$1("ctrl+shift+k")
    },
    label: (
      /** i18n */
      {
        id: "iQBQJa"
      }
    ),
    category: "Help",
    description: (
      /** i18n */
      {
        id: "l8m_KU"
      }
    )
  },
  CHECK_RESOURCES: {
    key: {
      mac: L$1("meta+shift+u"),
      windows: L$1("ctrl+shift+alt+u"),
      linux: L$1("ctrl+shift+alt+u")
    },
    label: (
      /** i18n */
      {
        id: "HiXs8k"
      }
    ),
    category: "Help",
    description: (
      /** i18n */
      {
        id: "1Stwdj"
      }
    )
  }
};
