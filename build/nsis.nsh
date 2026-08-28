!macro customInit
  SetOutPath $INSTDIR
  File /oname=version.json "public\version.json"
!macroend

!macro customInstall
  CreateShortCut "$DESKTOP\MaiTroll.lnk" "$INSTDIR\MaiTroll.exe" "" "$INSTDIR\public\icons\maitroll.ico"
!macroend

!macro customUnInit
  Delete "$DESKTOP\MaiTroll.lnk"
!macroend
