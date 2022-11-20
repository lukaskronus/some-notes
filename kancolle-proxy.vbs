Dim kc : Set kc = WScript.CreateObject("WScript.Shell")
WScript.sleep(100)
kc.currentdirectory = "path"
kc.run "proxy-win.exe", 0, false
WScript.sleep(100)
kc.currentdirectory = "path"
kc.run "ElectronicObserver.exe", 8, true
WScript.sleep(100)
kc.run "taskkill /f /im ElectronicObserver.exe /t", , true
kc.run "taskkill /f /im proxy-win.exe /t", , true
Set kc = Nothing
