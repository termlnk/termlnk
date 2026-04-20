{
  "targets": [
    {
      "target_name": "macos_utils",
      "conditions": [
        [
          "OS==\"mac\"",
          {
            "sources": [
              "src/window-utils.mm",
              "src/keyboard-inject.mm"
            ],
            "xcode_settings": {
              "CLANG_ENABLE_OBJC_ARC": "YES",
              "OTHER_LDFLAGS": [
                "-framework Cocoa",
                "-framework ApplicationServices",
                "-framework Carbon"
              ]
            }
          },
          {
            "type": "none"
          }
        ]
      ]
    }
  ]
}
